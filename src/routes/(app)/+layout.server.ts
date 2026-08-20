import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const CLAIM_EXEMPT_ROUTES = new Set(['/(app)/dashboard/claim', '/(app)/logout']);

export const load: LayoutServerLoad = async ({ parent, route, cookies }) => {
  // Reuse the root layout's cached user lookup instead of hitting the DB
  // again. This layout used to run its own `findUnique` with a handle +
  // profile include on every dashboard navigation, adding an extra round
  // trip that showed up as visible latency.
  const { user } = await parent();

  if (!user) {
    cookies.delete('user_session', { path: '/' });
    throw redirect(302, '/login');
  }

  if (!user.handle && !CLAIM_EXEMPT_ROUTES.has(route.id ?? '')) {
    throw redirect(302, '/dashboard/claim');
  }

  return { user };
};
