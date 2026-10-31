import { parseRules, type LinkRecord } from '@iksi/core';

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
    v: 1,
    id: row.id,
    destination,
    flagged: row.safeVerdict !== null && FLAGGED_VERDICTS.includes(row.safeVerdict),
    permanent: row.permanent,
    rules,
    expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
    expired: row.expiredAt !== null,
    protected: row.passwordHash !== null
  };
}
