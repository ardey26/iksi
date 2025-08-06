import { json } from '@sveltejs/kit';
import { DASHBOARD_PASSWORD } from '$env/static/private';

export const POST = async ({ request, cookies }) => {
	try {
		const { password } = await request.json();
		
		if (password === DASHBOARD_PASSWORD) {
			cookies.set('admin_authenticated', 'true', {
				path: '/',
				httpOnly: true,
				secure: false, // Set to true in production
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 // 24 hours
			});
			
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Invalid password' }, { status: 401 });
		}
	} catch (error) {
		console.error('Login error:', error);
		return json({ success: false, error: 'Login failed' }, { status: 500 });
	}
};
