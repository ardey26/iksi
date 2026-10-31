import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/env';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('admin_session', {
    path: '/',
    domain: dev ? undefined : 'admin.iksi.app'
  });
  redirect(303, '/admin/login');
};
