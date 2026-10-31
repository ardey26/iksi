import type { LinkRecord } from '@iksi/core';

export const FLAGGED_VERDICTS: readonly string[] = ['malware', 'phishing', 'unwanted'];

export function toLinkRecord(
  row: { id: number; safeVerdict: string | null },
  destination: string
): LinkRecord {
  return {
    v: 1,
    id: row.id,
    destination,
    flagged: row.safeVerdict !== null && FLAGGED_VERDICTS.includes(row.safeVerdict),
    permanent: false
  };
}
