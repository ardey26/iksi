import { error } from '@sveltejs/kit';
import { competitorIds } from '#lib/marketing/facts.js';

// Not prerendered: the root layout reads the session cookie for the header.

export function entries() {
  return competitorIds().map((competitor) => ({ competitor }));
}

export function load({ params }) {
  if (!competitorIds().includes(params.competitor)) error(404, 'Not found');
  return { id: params.competitor };
}
