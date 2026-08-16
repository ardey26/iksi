import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { verifySession } from '$lib/server/auth.js';

const PUBLIC_ROUTES = new Set(['/(admin)/admin/login']);

export const load: LayoutServerLoad = async ({ cookies, route }) => {
  if (PUBLIC_ROUTES.has(route.id ?? '')) return {};

  const token = cookies.get('admin_session');
  if (!verifySession(token)) throw redirect(302, '/admin/login');

  return { authenticated: true };
};
