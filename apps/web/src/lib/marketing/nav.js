// Path, label and kind of every marketing page, with no copy and no facts.
// The root layout and the footer read this list, so every page, profiles
// included, ships it instead of the full registry (pages.js), which pulls in
// facts.js and all the FAQ copy. pages.test.js checks the two lists match.

/** @typedef {{ path: string, label: string, kind: 'alternatives' | 'feature' | 'tool' | 'docs' }} MarketingLink */

/** @type {ReadonlyArray<MarketingLink>} */
export const MARKETING_NAV = [
  { path: '/alternatives', label: 'Compare tools', kind: 'alternatives' },
  { path: '/alternatives/linktree', label: 'Linktree alternative', kind: 'alternatives' },
  { path: '/alternatives/bitly', label: 'Bitly alternative', kind: 'alternatives' },
  { path: '/alternatives/tinyurl', label: 'TinyURL alternative', kind: 'alternatives' },
  { path: '/alternatives/dub', label: 'Dub alternative', kind: 'alternatives' },
  { path: '/alternatives/short-io', label: 'Short.io alternative', kind: 'alternatives' },
  { path: '/features/link-in-bio', label: 'Link-in-bio', kind: 'feature' },
  { path: '/features/smart-routing', label: 'Smart routing', kind: 'feature' },
  { path: '/features/password-protected-links', label: 'Password links', kind: 'feature' },
  { path: '/features/link-expiry', label: 'Link expiry', kind: 'feature' },
  { path: '/features/one-time-links', label: 'One-time links', kind: 'feature' },
  { path: '/tools/qr-code', label: 'QR code generator', kind: 'tool' },
  { path: '/tools/link-checker', label: 'Link checker', kind: 'tool' },
  { path: '/tools/url-expander', label: 'URL expander', kind: 'tool' }
];

/** @param {string} path */
export function isMarketingPath(path) {
  return MARKETING_NAV.some((p) => p.path === path);
}
