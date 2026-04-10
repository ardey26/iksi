import { redirect, error } from '@sveltejs/kit';
import { verifySession } from '$lib/server/auth.js';

const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

export const load = async ({ cookies, request }) => {
	const host = request.headers.get('host')?.split(':')[0] || '';
	const isAdminHost = ADMIN_HOSTS.includes(host);

	// Only allow admin access on admin subdomain
	if (!isAdminHost) {
		throw error(404, 'Not found');
	}

	const sessionToken = cookies.get('admin_session');
	const isAuthenticated = verifySession(sessionToken);

	if (isAuthenticated) {
		throw redirect(302, '/admin');
	}

	return {};
};
