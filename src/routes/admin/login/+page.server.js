import { redirect } from '@sveltejs/kit';

export const load = async ({ cookies }) => {
	// If already authenticated, redirect to dashboard
	const isAuthenticated = cookies.get('admin_authenticated') === 'true';
	
	if (isAuthenticated) {
		throw redirect(302, '/admin');
	}
	
	return {};
};
