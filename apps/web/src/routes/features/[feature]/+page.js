import { error } from '@sveltejs/kit';
import { featureSlugs } from '#lib/marketing/features.js';

// Not prerendered: the root layout reads the session cookie for the header.

export function entries() {
  return featureSlugs().map((feature) => ({ feature }));
}

export function load({ params }) {
  if (!featureSlugs().includes(params.feature)) error(404, 'Not found');
  return { slug: params.feature };
}
