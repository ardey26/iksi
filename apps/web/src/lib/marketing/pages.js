// Registry of indexable marketing pages. The footer, sitemap and SEO tags all
// read it; later pages append their entry here.

/**
 * @typedef {{
 *   path: string,
 *   title: string,
 *   description: string,
 *   kind: 'alternatives' | 'feature' | 'tool' | 'docs',
 *   structuredData?: () => object
 * }} MarketingPage
 */

/** @type {ReadonlyArray<MarketingPage>} */
export const MARKETING_PAGES = [];

/** @param {string} path @returns {MarketingPage | undefined} */
export function marketingPage(path) {
  return MARKETING_PAGES.find((p) => p.path === path);
}
