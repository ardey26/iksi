// The one source for every comparison table, page title and listing claim.
// Pages render from this file and never restate a fact on their own.
//
// iksi's column is read from the code, not from marketing copy. A competitor
// cell is the value for that product's FREE plan, copied from the vendor's
// own pricing or feature page on the product's `verified` date, with that
// page as `source`. A cell that could not be confirmed is left out, never
// guessed. "Free forever" applies to shortening only (see the pricing rule in
// the SEO spec); every other iksi row shows its `plan`.

/** @typedef {'linktree' | 'bitly' | 'tinyurl' | 'dub' | 'short-io'} CompetitorId */
/** @typedef {'iksi' | CompetitorId} ProductId */

/**
 * @typedef {{
 *   name: string,
 *   url: string,
 *   verified: string,
 *   pricingUrl: string
 * }} Product
 * `verified` is the YYYY-MM-DD day the values were last checked.
 */

/**
 * @typedef {{
 *   value: string,
 *   offered: boolean,
 *   plan?: 'free' | 'paid',
 *   forever?: boolean,
 *   feature?: string
 * }} IksiFact
 * `offered: false` marks a feature iksi does not have; it carries no `plan`.
 * `forever` is true on shortening only. `feature` is the features/* slug.
 */

/**
 * @typedef {{ value: string, source: string, gated?: true }} CompetitorFact
 * `source` is the vendor page the value was read from. `gated: true` is set
 * only when the value itself says the feature, as the cell describes it,
 * needs a paid plan. Pages quote gated values verbatim and never paraphrase.
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   iksi: IksiFact,
 *   competitors: Partial<Record<CompetitorId, CompetitorFact>>
 * }} Feature
 */

const LINKTREE_PRICING = 'https://linktr.ee/s/pricing';
const LINKTREE_SHORTENER = 'https://linktr.ee/features/link-shortener';
const BITLY_PRICING = 'https://bitly.com/pages/pricing/';
// TinyURL builds its "Feature Breakdown" table in the browser from its own
// /app/api/subscriptions data; the Free column was read from that data.
const TINYURL_PRICING = 'https://tinyurl.com/app/pricing';
const TINYURL_GUEST_LINKS = 'https://tinyurl.com/blog/i-created-tinyurl-link-without-account-how-edit-delete/';
const DUB_PRICING = 'https://dub.co/pricing/links';
const DUB_HELP = 'https://dub.co/help/article/';
const DUB_RATE_LIMITS = 'https://dub.co/docs/api-reference/rate-limits';
const SHORTIO_PRICING = 'https://short.io/pricing';

/** @type {Readonly<Partial<Record<ProductId, Product>>>} */
export const PRODUCTS = {
  iksi: { name: 'iksi', url: 'https://www.iksi.app', verified: '2026-11-06', pricingUrl: 'https://www.iksi.app/' },
  linktree: { name: 'Linktree', url: 'https://linktr.ee', verified: '2026-11-06', pricingUrl: LINKTREE_PRICING },
  bitly: { name: 'Bitly', url: 'https://bitly.com', verified: '2026-11-06', pricingUrl: BITLY_PRICING },
  tinyurl: { name: 'TinyURL', url: 'https://tinyurl.com', verified: '2026-11-06', pricingUrl: TINYURL_PRICING },
  dub: { name: 'Dub', url: 'https://dub.co', verified: '2026-11-06', pricingUrl: DUB_PRICING },
  'short-io': { name: 'Short.io', url: 'https://short.io', verified: '2026-11-06', pricingUrl: SHORTIO_PRICING }
};

/** @type {ReadonlyArray<Feature>} */
export const FEATURES = [
  {
    id: 'shortening',
    label: 'Link shortening',
    iksi: { value: 'No monthly limit, no account needed', offered: true, plan: 'free', forever: true },
    competitors: {
      linktree: {
        value: 'Basic tr.ee short links. Sending visitors straight to the destination needs Starter',
        source: LINKTREE_PRICING
      },
      bitly: { value: '5 links a month, with ads', source: BITLY_PRICING },
      tinyurl: {
        value: 'Short links without an account, saved only in your browser until you claim them into an account',
        source: TINYURL_GUEST_LINKS
      },
      dub: { value: '25 new links a month', source: DUB_PRICING },
      'short-io': { value: "1,000 links over the account's lifetime", source: SHORTIO_PRICING }
    }
  },
  {
    id: 'custom-alias',
    label: 'Custom alias',
    iksi: { value: 'Up to 50 characters, no account needed', offered: true, plan: 'free' },
    competitors: {
      linktree: { value: 'Custom back-halves need Starter', gated: true, source: LINKTREE_PRICING },
      bitly: { value: '3 custom back-halves a month', source: BITLY_PRICING },
      tinyurl: { value: 'Custom aliases, such as tinyurl.com/alias', source: TINYURL_PRICING },
      'short-io': { value: 'Custom slugs on every plan', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'qr-code',
    label: 'QR code',
    iksi: { value: 'PNG QR code for each new short link', offered: true, plan: 'free' },
    competitors: {
      linktree: { value: 'QR code for your Linktree. Custom colors and logo need Starter', source: LINKTREE_PRICING },
      bitly: { value: '2 QR codes a month', source: BITLY_PRICING },
      dub: {
        value: 'QR codes carry the Dub logo. Removing it or adding your own needs Pro',
        source: `${DUB_HELP}custom-qr-codes`
      },
      'short-io': { value: 'QR codes with custom colors and logos', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'link-in-bio',
    label: 'Link-in-bio page',
    iksi: {
      value: 'Profile at iksi.app/@handle where every row is an iksi short link',
      offered: true,
      plan: 'free',
      feature: 'link-in-bio'
    },
    competitors: {
      linktree: { value: 'Unlimited basic links and 1 featured link', source: LINKTREE_PRICING },
      bitly: { value: '2 pages, with Bitly branding', source: BITLY_PRICING },
      'short-io': {
        value: 'Link bundles: one short link that opens a branded page of your links',
        source: SHORTIO_PRICING
      }
    }
  },
  {
    id: 'smart-routing',
    label: 'Routing by country, continent, device, OS, referrer or time',
    iksi: {
      value: 'Up to 20 rules per link by country, continent, device, OS, referrer or time of day',
      offered: true,
      plan: 'free',
      feature: 'smart-routing'
    },
    competitors: {
      linktree: { value: 'Rules by location or referrer need Premium', gated: true, source: LINKTREE_PRICING },
      dub: { value: 'Geo targeting needs Pro', gated: true, source: `${DUB_HELP}geo-targeting` },
      'short-io': { value: 'Mobile OS targeting. Country targeting needs Hobby', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'ab-split',
    label: 'A/B split',
    iksi: { value: '2 to 5 weighted destinations per rule', offered: true, plan: 'free' },
    competitors: {
      dub: { value: 'A/B testing needs Business', gated: true, source: `${DUB_HELP}ab-testing` },
      'short-io': { value: 'A/B testing on every plan', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'password',
    label: 'Password-protected links',
    iksi: { value: 'A password on any link you own', offered: true, plan: 'free', feature: 'password-protected-links' },
    competitors: {
      linktree: { value: 'Password and code lock need Pro', gated: true, source: LINKTREE_PRICING },
      dub: { value: 'Password protection needs Pro', gated: true, source: `${DUB_HELP}password-protected-links` },
      'short-io': { value: 'Password protection needs Pro', gated: true, source: SHORTIO_PRICING }
    }
  },
  {
    id: 'expiry',
    label: 'Link expiry',
    iksi: { value: 'By date, by click limit, or both', offered: true, plan: 'free', feature: 'link-expiry' },
    competitors: {
      linktree: { value: 'Scheduling a link to go live and disappear needs Starter', gated: true, source: LINKTREE_PRICING },
      bitly: { value: 'Link expiration needs Growth', gated: true, source: BITLY_PRICING },
      tinyurl: { value: 'Setting expiration dates needs Pro', gated: true, source: TINYURL_PRICING },
      dub: { value: 'Link expiration needs Pro', gated: true, source: `${DUB_HELP}link-expiration` },
      'short-io': { value: 'Expiry by date or click limit needs Pro', gated: true, source: SHORTIO_PRICING }
    }
  },
  {
    id: 'one-time-links',
    label: 'One-time links',
    iksi: {
      value: 'A URL or up to 2,000 characters of text that opens once. Unopened, it expires after 7 days',
      offered: true,
      plan: 'free',
      feature: 'one-time-links'
    },
    competitors: {}
  },
  {
    id: 'analytics',
    label: 'Click analytics',
    iksi: {
      value: 'Total clicks per link, plus profile visits, clicks and clickthrough rate',
      offered: true,
      plan: 'free'
    },
    competitors: {
      linktree: {
        value: 'Lifetime totals, with 28 days of history. Per-link, location, device and referrer data need a paid plan',
        source: LINKTREE_PRICING
      },
      bitly: { value: 'No click history. Country, device and referrer data need a paid plan', source: BITLY_PRICING },
      tinyurl: { value: 'Click analytics, including total clicks, need Pro', gated: true, source: TINYURL_PRICING },
      dub: {
        value: '1,000 tracked events a month, broken down by location, device and referrer',
        source: `${DUB_HELP}dub-analytics-limits`
      },
      'short-io': {
        value: 'Stats by country, device and language for 50,000 clicks a month',
        source: SHORTIO_PRICING
      }
    }
  },
  {
    id: 'safe-browsing',
    label: 'Malicious link checks',
    iksi: { value: 'Every destination checked with Google Safe Browsing', offered: true, plan: 'free' },
    competitors: {
      linktree: { value: 'Malicious short links blocked automatically', source: LINKTREE_SHORTENER }
    }
  },
  {
    id: 'api',
    label: 'API',
    iksi: {
      value: 'Up to 10 keys to shorten links and read your profile, 30 requests a minute per key',
      offered: true,
      plan: 'free'
    },
    competitors: {
      bitly: { value: '1,000 requests a month', source: BITLY_PRICING },
      dub: { value: '60 requests a minute per key', source: DUB_RATE_LIMITS },
      'short-io': {
        value: '50 requests a second. 1,000 links in total by API or bulk create',
        source: SHORTIO_PRICING
      }
    }
  },
  {
    id: 'browser-extension',
    label: 'Browser extension',
    iksi: { value: 'Chrome', offered: true, plan: 'free' },
    competitors: {
      bitly: { value: 'Chrome, Edge and Firefox', source: BITLY_PRICING },
      'short-io': { value: 'Browser extensions, plus mobile and desktop apps', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'payments',
    label: 'Payments on your profile',
    iksi: {
      value:
        'A Pay button with up to 6 payment QR codes or PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe links. Payers pay in their own app',
      offered: true,
      plan: 'free'
    },
    competitors: {
      linktree: {
        value: 'Paid products and bookings need Pro. Inbox tips carry a 12% fee', gated: true,
        source: LINKTREE_PRICING
      }
    }
  },
  {
    id: 'custom-domains',
    label: 'Custom domains',
    iksi: { value: 'Not offered', offered: false },
    competitors: {
      bitly: { value: 'A custom domain needs Growth', gated: true, source: BITLY_PRICING },
      tinyurl: { value: 'Connecting your own domain needs Pro', gated: true, source: TINYURL_PRICING },
      dub: { value: '3 custom domains', source: DUB_PRICING },
      'short-io': { value: '5 custom domains', source: SHORTIO_PRICING }
    }
  },
  {
    id: 'teams',
    label: 'Teams',
    iksi: { value: 'Not offered', offered: false },
    competitors: {
      linktree: { value: 'Team seats on Agency or Enterprise plans', source: LINKTREE_PRICING },
      bitly: { value: 'Multiple users on Enterprise only', source: BITLY_PRICING },
      dub: { value: '1 user. Inviting teammates needs Pro', gated: true, source: `${DUB_HELP}how-to-invite-teammates` },
      'short-io': { value: '1 user. More users need Team', gated: true, source: SHORTIO_PRICING }
    }
  }
];

/** Where iksi falls short. Every alternatives page shows these. */
export const GAPS = [
  'No custom domains. Every short link and profile lives on iksi.app.',
  'No teams. Each account belongs to one person, with no shared workspace or roles.',
  'Click analytics show totals only: clicks per link, plus profile visits, clicks and clickthrough rate. iksi records country, device, browser and referrer host for each click, but the dashboard does not break clicks down by them.',
  'The API creates short links and one-time links and reads your profile. It cannot set routing rules, expiry or a password on a regular link, or read click stats.',
  'The browser extension is for Chrome only.',
  'QR codes are black PNGs with the iksi mark in the middle. No custom colors, your own logo or SVG.'
];

/** @returns {CompetitorId[]} */
export function competitorIds() {
  return /** @type {CompetitorId[]} */ (Object.keys(PRODUCTS).filter((id) => id !== 'iksi'));
}

/** The latest competitor `verified` date: the sitemap lastmod for alternatives pages. */
export function newestVerified() {
  return competitorIds()
    .map((id) => /** @type {Product} */ (PRODUCTS[id]).verified)
    .reduce((a, b) => (b > a ? b : a), '');
}
