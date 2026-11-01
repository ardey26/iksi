import { CANONICAL_HOST, LINK_RECORD_VERSION, parseRules, type LinkRecord } from '@iksi/core';

export const FLAGGED_VERDICTS: readonly string[] = ['malware', 'phishing', 'unwanted'];

export function isFlagged(verdict: string | null | undefined): boolean {
  return verdict != null && FLAGGED_VERDICTS.includes(verdict);
}

/** What a one-time link's record carries instead of its content. */
const ONE_TIME_PLACEHOLDER = `https://${CANONICAL_HOST}/`;

export function toLinkRecord(
  row: {
    id: number;
    safeVerdict: string | null;
    rules: unknown;
    expiresAt: Date | null;
    expiredAt: Date | null;
    passwordHash: string | null;
    permanent: boolean;
    clickCount: number;
    maxClicks: number | null;
    oneTime: boolean;
  },
  destination: string
): LinkRecord {
  let rules: LinkRecord['rules'] = [];
  if (row.rules != null) {
    const parsed = parseRules(row.rules);
    if (parsed.ok) rules = parsed.rules;
    else console.error(`link ${row.id}: ignoring invalid stored rules: ${parsed.error}`);
  }
  return {
    v: LINK_RECORD_VERSION,
    id: row.id,
    // A one-time link's content never leaves the origin: the edge only learns
    // that the link exists, and gets a placeholder that parses as a URL.
    destination: row.oneTime ? ONE_TIME_PLACEHOLDER : destination,
    flagged: isFlagged(row.safeVerdict),
    permanent: row.permanent,
    rules,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    // Origin clicks (every unlock) bump clickCount without going through ingest,
    // which is the only place that sets expiredAt, so the cap is checked here too.
    expired: row.expiredAt !== null || (row.maxClicks !== null && row.clickCount >= row.maxClicks),
    // Protected makes every Worker hand the link to the origin, which is the
    // only place a one-time link is revealed (and burned). It reuses a v2 field,
    // so the record version does not change.
    protected: row.passwordHash !== null || row.oneTime
  };
}

/**
 * Every URL a link can send a visitor to: the default, then each rule and split
 * destination, once each. Safe Browsing checks all of them.
 */
export function destinationsOf(destination: string, rules: unknown): string[] {
  const urls = [destination];
  const parsed = rules == null ? null : parseRules(rules);
  if (parsed?.ok) {
    for (const rule of parsed.rules) {
      if ('split' in rule) urls.push(...rule.split.map((s) => s.destination));
      else urls.push(rule.destination);
    }
  }
  return [...new Set(urls)];
}
