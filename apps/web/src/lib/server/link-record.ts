import { LINK_RECORD_VERSION, parseRules, type LinkRecord } from '@iksi/core';

export const FLAGGED_VERDICTS: readonly string[] = ['malware', 'phishing', 'unwanted'];

export function isFlagged(verdict: string | null | undefined): boolean {
  return verdict != null && FLAGGED_VERDICTS.includes(verdict);
}

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
    destination,
    flagged: isFlagged(row.safeVerdict),
    permanent: row.permanent,
    rules,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    // Origin clicks (every unlock) bump clickCount without going through ingest,
    // which is the only place that sets expiredAt, so the cap is checked here too.
    expired: row.expiredAt !== null || (row.maxClicks !== null && row.clickCount >= row.maxClicks),
    protected: row.passwordHash !== null
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
