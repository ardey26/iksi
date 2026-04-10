import { json } from '@sveltejs/kit';
import { createSession, verifyPassword } from '$lib/server/auth.js';
import { dev } from '$app/environment';

export const POST = async ({ request, cookies }) => {
	try {
		const { password } = await request.json();

		const isValid = await verifyPassword(password);

		if (isValid) {
			const sessionToken = createSession();

			cookies.set('admin_session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: !dev,
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 // 24 hours
			});

			return json({ success: true });
		} else {
			return json({ success: false, error: 'Invalid password' }, { status: 401 });
		}
	} catch (err) {
		console.error('Login error:', err);
		return json({ success: false, error: 'Login failed' }, { status: 500 });
	}
};
