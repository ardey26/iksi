import { json } from '@sveltejs/kit';

export const POST = async ({ cookies }) => {
	cookies.delete('admin_authenticated', { path: '/' });
	return json({ success: true });
};
