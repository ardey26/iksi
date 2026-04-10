import { redirect } from '@sveltejs/kit';
import { verifySession } from '$lib/server/auth.js';

export const load = async ({ cookies }) => {
	const sessionToken = cookies.get('admin_session');
	const isAuthenticated = verifySession(sessionToken);

	if (isAuthenticated) {
		throw redirect(302, '/admin');
	}

	return {};
};
