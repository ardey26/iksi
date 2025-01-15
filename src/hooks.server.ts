import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    if (event.request.method === 'GET' && event.url.pathname.startsWith('/api')) {
        return new Response(null, {
            status: 302,
            headers: {
                Location: '/'
            }
        });
    }

    return resolve(event);
};
