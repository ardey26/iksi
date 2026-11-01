/**
 * Reporting a short link (the /report page): the reasons, the limits and how
 * the link a visitor typed is read. Universal, so the form and the server
 * agree on both.
 */
import { CANONICAL_HOST, classifyPath, normalizeHost } from '@iksi/core';
import { appHref, handlePath, subdomainHandleOf } from '#lib/subdomains.js';

export const REPORT_REASONS = [
  { value: 'phishing', label: 'Phishing or scam' },
  { value: 'malware', label: 'Malware' },
  { value: 'spam', label: 'Spam' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'other', label: 'Other' }
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

/** Reasons that count toward holding a link for review. */
export const URGENT_REASONS: readonly ReportReason[] = ['phishing', 'malware'];

export const DETAILS_MAX = 1000;
export const EMAIL_MAX = 254;
export const LINK_INPUT_MAX = 300;

/** The honeypot field: hidden from people, filled in by form-filling bots. */
export const HONEYPOT = 'website';

export const REPORT_THANKS = "Thanks. We'll review it.";

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

export function reasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? 'Other';
}

const BARE = /^@?[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)?\+?$/;

/**
 * The stored slug a typed short link names (`abc`, `@andre/sale`), or null
 * when it is not an iksi short link. Takes `abc`, `abc+`, `iksi.app/abc`,
 * `https://www.iksi.app/@andre/sale` and `andre.iksi.app/sale`. Says nothing
 * about whether the link exists.
 */
export function parseReportLink(value: string, dev = false): string | null {
  const input = value.trim();
  if (input === '' || input.length > LINK_INPUT_MAX) return null;

  let pathname: string;
  if (BARE.test(input)) {
    pathname = `/${input}`;
  } else if (BARE.test(input.slice(1)) && input.startsWith('/')) {
    pathname = input;
  } else {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = normalizeHost(url.host);
    const handle = subdomainHandleOf(url.host, dev);
    const local = dev && (host === 'localhost' || host === '127.0.0.1');
    if (handle) {
      const routed = handlePath(handle, url.pathname);
      if (!routed || routed === `/@${handle}`) return null;
      pathname = routed;
    } else if (host === CANONICAL_HOST || local) {
      pathname = url.pathname;
    } else {
      return null;
    }
  }

  const path = classifyPath(pathname);
  return path.kind === 'slug' || path.kind === 'scoped' ? path.slug : null;
}

/**
 * "Report this link" from a short link's own page (`url`): /report with the
 * link prefilled, on www even from a profile subdomain.
 */
export function reportHref(url: URL, dev = false): string {
  const host = normalizeHost(url.host) === CANONICAL_HOST ? CANONICAL_HOST : url.host;
  const link = `${host}${url.pathname.replace(/\+(stats)?$/, '')}`;
  return appHref(`/report?link=${encodeURIComponent(link)}`, url.host, dev);
}
