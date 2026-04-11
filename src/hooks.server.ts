import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';
import { verifyUserSession, hashApiKey } from '$lib/server/auth.js';
import { RESERVED_USERNAMES } from '$lib/utils/username.js';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];
const MAIN_HOSTS = ['iksi.app', 'localhost', 'www.iksi.app'];

// Cache for admin slug lookup (reduces DB queries on hot path)
let adminSlugCache: { url: string | null; expires: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

async function getAdminSlugURL(): Promise<string | null> {
    const now = Date.now();

    // Return cached result if valid
    if (adminSlugCache && adminSlugCache.expires > now) {
        return adminSlugCache.url;
    }

    // Fetch from database
    const longURL = await prisma.longURL.findFirst({
        where: { shortURL: 'admin' },
        select: { originalURL: true }
    });

    const url = longURL ? await decodeURL(longURL.originalURL) : null;

    // Cache the result
    adminSlugCache = { url, expires: now + CACHE_TTL };

    return url;
}

export const handle: Handle = async ({ event, resolve }) => {
    // --- Auth resolution ---
    event.locals.user = null;

    // Try session cookie first
    const sessionToken = event.cookies.get('session');
    if (sessionToken) {
        const user = await verifyUserSession(sessionToken);
        if (user) {
            event.locals.user = user;
        }
    }

    // Fall back to API key
    if (!event.locals.user) {
        const authHeader = event.request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const rawKey = authHeader.slice(7);
            if (rawKey.startsWith('ik_')) {
                const keyHash = hashApiKey(rawKey);
                const apiKey = await prisma.apiKey.findUnique({
                    where: { keyHash },
                    select: {
                        id: true,
                        user: {
                            select: {
                                id: true,
                                provider: true,
                                providerId: true,
                                email: true,
                                name: true,
                                avatarUrl: true,
                                username: true,
                                showPreview: true
                            }
                        }
                    }
                });

                if (apiKey) {
                    event.locals.user = apiKey.user;
                    // Update lastUsedAt in background (don't await)
                    prisma.apiKey.update({
                        where: { id: apiKey.id },
                        data: { lastUsedAt: new Date() }
                    }).catch(() => {});
                }
            }
        }
    }

    // Redirect to onboarding if user is logged in but has no username
    // Skip for onboarding page itself, auth routes, and API routes
    const pathname = event.url.pathname;
    const skipOnboarding = pathname.startsWith('/onboarding') ||
                           pathname.startsWith('/auth') ||
                           pathname.startsWith('/api');

    if (event.locals.user && !event.locals.user.username && !skipOnboarding) {
        return new Response(null, {
            status: 302,
            headers: { Location: '/onboarding' }
        });
    }

    // --- Host detection and profile subdomain routing ---
    const host = event.request.headers.get('host')?.split(':')[0] || '';
    const isAdminHost = ADMIN_HOSTS.includes(host);
    const isMainHost = MAIN_HOSTS.includes(host);

    // Initialize profile locals
    event.locals.profileUsername = null;
    event.locals.profileUser = null;

    // Profile subdomain detection
    // Pattern: username.iksi.app or username.localhost
    if (!isAdminHost && !isMainHost) {
        const match = host.match(/^([a-z0-9-]+)\.(iksi\.app|localhost)$/);
        if (match) {
            const profileUsername = match[1];

            // Skip reserved usernames (admin, api, cdn, etc.) without DB query
            if (!RESERVED_USERNAMES.includes(profileUsername)) {
                event.locals.profileUsername = profileUsername;

                // Look up the profile user
                const profileUser = await prisma.user.findUnique({
                    where: { username: profileUsername },
                    select: {
                        id: true,
                        username: true,
                        name: true,
                        avatarUrl: true
                    }
                });

                // profileUser could be null if username doesn't exist - routes handle 404
                event.locals.profileUser = profileUser;

                // Rewrite path to /profile routes
                const url = new URL(event.request.url);
                url.pathname = '/profile' + url.pathname;
                event.request = new Request(url, event.request);
            }
        }
    }

    // --- Existing logic below (unchanged except API redirect scope) ---

    // On non-admin hosts, treat /admin as a potential short link (slug)
    // This allows "admin" to be a custom short link
    if (!isAdminHost && event.url.pathname === '/admin') {
        const decodedURL = await getAdminSlugURL();

        if (decodedURL) {
            throw redirect(302, decodedURL);
        }
        // If no short link exists, let the route handle the 404
        // (this allows custom error page to render)
    }

    // For /admin/* sub-routes on non-admin hosts, let the route handle the 404
    // (route server loads have host checks that throw error(404), which renders custom error page)

    // On admin subdomain, redirect root to /admin
    if (isAdminHost && event.url.pathname === '/') {
        return new Response(null, {
            status: 302,
            headers: { Location: '/admin' }
        });
    }

    // Scope redirect to /api/shorten only (was /api/*)
    if (event.request.method === 'GET' && event.url.pathname === '/api/shorten') {
        return new Response(null, {
            status: 302,
            headers: {
                Location: '/'
            }
        });
    }

    const response = await resolve(event);

    // Add security and performance headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://*.googleusercontent.com",
        "connect-src 'self'",
        "frame-ancestors 'none'"
    ].join('; '));

    // Cache control for static assets
    if (event.url.pathname.startsWith('/static/') || event.url.pathname.includes('.')) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return response;
};
