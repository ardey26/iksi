import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/utils/crypto.js';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

export const handle: Handle = async ({ event, resolve }) => {
    const host = event.request.headers.get('host')?.split(':')[0] || '';
    const isAdminHost = ADMIN_HOSTS.includes(host);

    // On non-admin hosts, treat /admin as a potential short link (slug)
    // This allows "admin" to be a custom short link
    if (!isAdminHost && event.url.pathname === '/admin') {
        const longURL = await prisma.longURL.findFirst({
            where: { shortURL: 'admin' },
            select: { originalURL: true }
        });

        if (longURL) {
            const decodedURL = await decodeURL(longURL.originalURL);
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

    if (event.request.method === 'GET' && event.url.pathname.startsWith('/api')) {
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
    
    // Cache control for static assets
    if (event.url.pathname.startsWith('/static/') || event.url.pathname.includes('.')) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    
    return response;
};
