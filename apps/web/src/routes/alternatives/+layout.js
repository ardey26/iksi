// This page's SEO for the root layout (page.data.marketing). Loaded here, not
// in the root layout, so the facts and FAQ copy stay off every other page.
import { marketingLayoutLoad } from '#lib/marketing/pages.js';

export const load = marketingLayoutLoad;
