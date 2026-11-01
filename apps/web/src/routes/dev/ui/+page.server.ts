import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';

// The UI kit gallery is a development tool: it does not exist in production.
export const load: PageServerLoad = () => {
  if (!dev) error(404, 'Not found');
  return {};
};
