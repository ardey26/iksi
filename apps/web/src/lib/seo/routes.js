import { organization, softwareApplication, website, withGraph } from './schema.js';

const OG_IMAGE = 'https://www.iksi.app/og-image.png';

export function homepageStructuredData() {
  return withGraph(website(), softwareApplication(), organization());
}

/**
 * @param {string} pathname The routed path.
 * @param {string} host
 * @param {{ path: string, title: string, description: string, structuredData: object | null } | null} [marketing]
 *   A marketing page's SEO, from its section layout load (page.data.marketing).
 */
export function seoForRoute(pathname, host, marketing = null) {
  const isAdminHost = host === 'admin.iksi.app' || host === 'admin.localhost';
  if (isAdminHost) {
    return {
      title: 'iksi admin',
      description: 'iksi admin area.',
      canonical: `https://admin.iksi.app${pathname}`,
      ogImage: OG_IMAGE,
      structuredData: null,
      noindex: true
    };
  }
  if (pathname === '/') {
    return {
      title: 'iksi — free URL shortener. Make long links short.',
      description: 'iksi turns long URLs into clean, shareable short links in seconds. Free, no signup, custom aliases, instant redirects.',
      canonical: 'https://www.iksi.app/',
      ogImage: OG_IMAGE,
      structuredData: homepageStructuredData(),
      noindex: false
    };
  }
  if (pathname === '/privacy') {
    return {
      title: 'Privacy | iksi',
      description: 'What iksi collects when you shorten links or build a profile, who handles it, how long it is kept, and how to get it deleted.',
      canonical: 'https://www.iksi.app/privacy',
      ogImage: OG_IMAGE,
      structuredData: null,
      noindex: false
    };
  }
  if (marketing && marketing.path === pathname) {
    return {
      title: marketing.title,
      description: marketing.description,
      canonical: `https://www.iksi.app${marketing.path}`,
      ogImage: OG_IMAGE,
      structuredData: marketing.structuredData,
      noindex: false
    };
  }
  // Always www: andre.iksi.app/sale is a vanity alias of www/@andre/sale.
  return {
    title: 'iksi — free URL shortener',
    description: 'iksi turns long URLs into clean, shareable short links in seconds.',
    canonical: `https://www.iksi.app${pathname}`,
    ogImage: OG_IMAGE,
    structuredData: null,
    noindex: true
  };
}
