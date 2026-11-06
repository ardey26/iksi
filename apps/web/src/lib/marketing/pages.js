// Registry of indexable marketing pages. The footer, sitemap and SEO tags all
// read it; later pages append their entry here.
import { PRODUCTS, competitorIds } from './facts.js';
import { alternativeCopy, hubCopy } from './alternatives.js';
import { FEATURE_PAGES, featureSlugs } from './features.js';
import { QR_TOOL } from './qr-tool.js';
import { faqPage, softwareApplication, withGraph } from '../seo/schema.js';

/**
 * @typedef {{
 *   path: string,
 *   label: string,
 *   title: string,
 *   description: string,
 *   kind: 'alternatives' | 'feature' | 'tool' | 'docs',
 *   structuredData?: () => object
 * }} MarketingPage
 */

/** @type {ReadonlyArray<MarketingPage>} */
export const MARKETING_PAGES = [
  {
    path: '/alternatives',
    label: 'Compare tools',
    ...pick(hubCopy()),
    kind: 'alternatives',
    structuredData: () => withGraph(softwareApplication())
  },
  ...competitorIds().map((id) => ({
    path: `/alternatives/${id}`,
    label: `${PRODUCTS[id].name} alternative`,
    ...pick(alternativeCopy(id)),
    kind: /** @type {const} */ ('alternatives'),
    structuredData: () => withGraph(softwareApplication(), faqPage(alternativeCopy(id).faq))
  })),
  ...featureSlugs().map((slug) => ({
    path: `/features/${slug}`,
    label: FEATURE_PAGES[slug].label,
    ...pick(FEATURE_PAGES[slug]),
    kind: /** @type {const} */ ('feature'),
    structuredData: () => withGraph(softwareApplication(), faqPage(FEATURE_PAGES[slug].faq))
  })),
  {
    path: '/tools/qr-code',
    label: QR_TOOL.label,
    ...pick(QR_TOOL),
    kind: 'tool',
    structuredData: () => withGraph(softwareApplication(), faqPage(QR_TOOL.faq))
  }
];

/** @param {{ title: string, description: string }} c */
function pick({ title, description }) {
  return { title, description };
}

/** @param {string} path @returns {MarketingPage | undefined} */
export function marketingPage(path) {
  return MARKETING_PAGES.find((p) => p.path === path);
}
