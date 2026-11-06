import { CHROME_EXTENSION_URL } from '../extension-store';

const ORIGIN = 'https://www.iksi.app';

export function organization() {
  return {
    '@type': 'Organization',
    '@id': `${ORIGIN}/#org`,
    name: 'iksi',
    url: `${ORIGIN}/`,
    logo: `${ORIGIN}/favicon.png`,
    sameAs: ['https://github.com/ardey26/iksi', CHROME_EXTENSION_URL]
  };
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': `${ORIGIN}/#website`,
    url: `${ORIGIN}/`,
    name: 'iksi',
    description: 'Free URL shortener. Transform long links into clean, shareable short URLs.',
    inLanguage: 'en'
  };
}

export function softwareApplication() {
  return {
    '@type': 'WebApplication',
    '@id': `${ORIGIN}/#app`,
    name: 'iksi',
    url: `${ORIGIN}/`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    description: 'A fast, free URL shortener with custom aliases and instant redirects. No registration required.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': `${ORIGIN}/#org` }
  };
}

/** @param {{ q: string, a: string }[]} items */
export function faqPage(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a }
    }))
  };
}

/** @param {...object} nodes */
export function withGraph(...nodes) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
