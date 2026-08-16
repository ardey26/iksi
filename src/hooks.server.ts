import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/server/crypto.js';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

// Cache for admin slug lookup on non-admin hosts (allows "admin" as a custom short link)
let adminSlugCache: { url: string | null; expires: number } | null = null;
const CACHE_TTL = 60000;

async function getAdminSlugURL(): Promise<string | null> {
    const now = Date.now();
    if (adminSlugCache && adminSlugCache.expires > now) return adminSlugCache.url;
    const longURL = await prisma.longURL.findFirst({
        where: { shortURL: 'admin' },
        select: { originalURL: true }
    });
    const url = longURL ? await decodeURL(longURL.originalURL) : null;
    adminSlugCache = { url, expires: now + CACHE_TTL };
    return url;
}

function isAdminGroupRoute(routeId: string | null): boolean {
    return !!routeId && routeId.startsWith('/(admin)');
}

export const handle: Handle = async ({ event, resolve }) => {
    const host = event.request.headers.get('host')?.split(':')[0] || '';
    const isAdminHost = ADMIN_HOSTS.includes(host);
    const routeId = event.route.id;
    const inAdminGroup = isAdminGroupRoute(routeId);

    // 1. Host gating: admin routes only reachable on admin hosts.
    if (inAdminGroup && !isAdminHost) {
        return new Response('Not Found', { status: 404 });
    }

    // 2. On admin subdomain, redirect root to /admin (dashboard). Any other
    //    non-admin-group route is 404 so the public homepage/slugs don't leak.
    if (isAdminHost && !inAdminGroup) {
        if (event.url.pathname === '/') {
            return new Response(null, { status: 302, headers: { Location: '/admin' } });
        }
        if (routeId !== null) {
            return new Response('Not Found', { status: 404 });
        }
    }

    // 3. Special case: "admin" as a custom short link on the public host.
    if (!isAdminHost && event.url.pathname === '/admin') {
        const decodedURL = await getAdminSlugURL();
        if (decodedURL) throw redirect(302, decodedURL);
    }

    // 4. Block direct GETs to /api on the public host.
    if (event.request.method === 'GET' && event.url.pathname.startsWith('/api')) {
        return new Response(null, { status: 302, headers: { Location: '/' } });
    }

    const response = await resolve(event);

    // Security + performance headers (unchanged from before)
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://adservice.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
        "connect-src 'self' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",
        "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
        "frame-ancestors 'none'"
    ].join('; '));

    if (event.url.pathname.startsWith('/static/') || event.url.pathname.includes('.')) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return response;
};
