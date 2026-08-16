import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('admin_session', {
    path: '/',
    domain: dev ? undefined : 'admin.iksi.app'
  });
  throw redirect(303, '/admin/login');
};
