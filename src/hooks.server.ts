import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

export const handle: Handle = async ({ event, resolve }) => {
    // Subdomain routing: Block admin routes on non-admin hosts
    const host = event.request.headers.get('host')?.split(':')[0] || '';
    const isAdminHost = ADMIN_HOSTS.includes(host);
    const isAdminRoute = event.url.pathname.startsWith('/admin');

    if (isAdminRoute && !isAdminHost) {
        throw error(404, 'Not found');
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
