import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { subdomainsEnabled } from '#lib/server/subdomains.js';

const CLAIM_EXEMPT_ROUTES = new Set(['/(app)/dashboard/claim', '/(app)/logout']);

export const load: LayoutServerLoad = async ({ parent, route, cookies }) => {
  // Reuse the root layout's cached user lookup instead of hitting the DB
  // again. This layout used to run its own `findUnique` with a handle +
  // profile include on every dashboard navigation, adding an extra round
  // trip that showed up as visible latency.
  const { user } = await parent();

  if (!user) {
    cookies.delete('user_session', { path: '/' });
    redirect(302, '/login');
  }

  if (!user.handle && !CLAIM_EXEMPT_ROUTES.has(route.id ?? '')) {
    redirect(302, '/dashboard/claim');
  }

  // Profile addresses in the dashboard follow the same rule as the canonical URL.
  return { user, subdomains: subdomainsEnabled() };
};
