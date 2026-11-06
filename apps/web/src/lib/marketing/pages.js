// Registry of indexable marketing pages. The sitemap and SEO tags read it;
// later pages append their entry here and in nav.js, the copy-free list the
// root layout and footer use (pages.test.js keeps the two in step).
import { PRODUCTS, competitorIds } from './facts.js';
import { alternativeCopy, hubCopy } from './alternatives.js';
import { FEATURE_PAGES, featureSlugs } from './features.js';
import { QR_TOOL } from './qr-tool.js';
import { LINK_CHECKER, URL_EXPANDER } from './link-tools.js';
import { faqPage, organization, softwareApplication, withGraph } from '../seo/schema.js';

// WebApplication.author points at #org, so the Organization rides along in every graph.
/** @param {...object} nodes */
const graph = (...nodes) => withGraph(softwareApplication(), organization(), ...nodes);

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
    structuredData: () => graph()
  },
  ...competitorIds().map((id) => ({
    path: `/alternatives/${id}`,
    label: `${PRODUCTS[id].name} alternative`,
    ...pick(alternativeCopy(id)),
    kind: /** @type {const} */ ('alternatives'),
    structuredData: () => graph(faqPage(alternativeCopy(id).faq))
  })),
  ...featureSlugs().map((slug) => ({
    path: `/features/${slug}`,
    label: FEATURE_PAGES[slug].label,
    ...pick(FEATURE_PAGES[slug]),
    kind: /** @type {const} */ ('feature'),
    structuredData: () => graph(faqPage(FEATURE_PAGES[slug].faq))
  })),
  {
    path: '/tools/qr-code',
    label: QR_TOOL.label,
    ...pick(QR_TOOL),
    kind: 'tool',
    structuredData: () => graph(faqPage(QR_TOOL.faq))
  },
  {
    path: '/tools/link-checker',
    label: LINK_CHECKER.label,
    ...pick(LINK_CHECKER),
    kind: 'tool',
    structuredData: () => graph(faqPage(LINK_CHECKER.faq))
  },
  {
    path: '/tools/url-expander',
    label: URL_EXPANDER.label,
    ...pick(URL_EXPANDER),
    kind: 'tool',
    structuredData: () => graph(faqPage(URL_EXPANDER.faq))
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

/**
 * The SEO a marketing page hands the root layout through page.data, or null.
 * Structured data is built here, so the layout never imports the registry.
 * @param {string} path
 */
export function marketingSeo(path) {
  const p = marketingPage(path);
  if (!p) return null;
  return {
    path: p.path,
    title: p.title,
    description: p.description,
    structuredData: p.structuredData ? p.structuredData() : null
  };
}

/** Load for each marketing section's +layout.js. @param {{ url: URL }} event */
export function marketingLayoutLoad({ url }) {
  return { marketing: marketingSeo(url.pathname) };
}
