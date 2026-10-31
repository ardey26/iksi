import { LINK_RECORD_VERSION, parseRules, type LinkRecord } from '@iksi/core';

export const FLAGGED_VERDICTS: readonly string[] = ['malware', 'phishing', 'unwanted'];

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
    flagged: row.safeVerdict !== null && FLAGGED_VERDICTS.includes(row.safeVerdict),
    permanent: row.permanent,
    rules,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    // Origin clicks (every unlock) bump clickCount without going through ingest,
    // which is the only place that sets expiredAt, so the cap is checked here too.
    expired: row.expiredAt !== null || (row.maxClicks !== null && row.clickCount >= row.maxClicks),
    protected: row.passwordHash !== null
  };
}
