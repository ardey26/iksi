import { describe, it, expect, vi } from 'vitest';
import { claimOneTime, oneTimeState } from './one-time';

const NOW = 1_700_000_000_000;
const row = (over: Record<string, unknown> = {}) => ({
  safeVerdict: null as string | null,
  openedAt: null as Date | null,
  expiredAt: null as Date | null,
  expiresAt: new Date(NOW + 60_000) as Date | null,
  ...over
});

describe('oneTimeState', () => {
  it('an unopened, unexpired link is sealed', () => expect(oneTimeState(row(), NOW)).toBe('sealed'));
  it('no expiry is sealed', () => expect(oneTimeState(row({ expiresAt: null }), NOW)).toBe('sealed'));
  it('opened', () => expect(oneTimeState(row({ openedAt: new Date(NOW - 1) }), NOW)).toBe('opened'));
  it('expired by date, including exactly now', () => {
    expect(oneTimeState(row({ expiresAt: new Date(NOW - 1) }), NOW)).toBe('expired');
    expect(oneTimeState(row({ expiresAt: new Date(NOW) }), NOW)).toBe('expired');
  });
  it('expired by mark', () => expect(oneTimeState(row({ expiredAt: new Date() }), NOW)).toBe('expired'));
  it('opened beats expired: the visitor learns it was used', () =>
    expect(oneTimeState(row({ openedAt: new Date(), expiresAt: new Date(NOW - 1) }), NOW)).toBe('opened'));
  it('flagged beats everything', () =>
    expect(oneTimeState(row({ safeVerdict: 'phishing', openedAt: new Date() }), NOW)).toBe('flagged'));
  it.each(['safe', 'pending'])('%s verdict is not flagged', (safeVerdict) =>
    expect(oneTimeState(row({ safeVerdict }), NOW)).toBe('sealed'));
});

describe('claimOneTime', () => {
  const db = (affected: number) => ({ $executeRaw: vi.fn(async () => affected) });

  it('is one conditional UPDATE that erases the content and marks it opened', async () => {
    const d = db(1);
    await claimOneTime(d, 9, NOW);
    expect(d.$executeRaw).toHaveBeenCalledTimes(1);
    const query = (d.$executeRaw.mock.calls[0] as unknown[])[0] as { text: string; values: unknown[] };
    const sql = query.text.replace(/\s+/g, ' ');
    expect(sql).toMatch(/^ ?UPDATE "LongURL" SET "openedAt" = \$1, "secret" = NULL WHERE /);
    expect(sql).toContain('"id" = $2');
    expect(sql).toContain('"oneTime" = true');
    expect(sql).toContain('"openedAt" IS NULL');
    expect(sql).toContain('"secret" IS NOT NULL');
    expect(sql).toContain('"expiredAt" IS NULL');
    expect(sql).toMatch(/\("expiresAt" IS NULL OR "expiresAt" > \$\d+\)/);
    expect(sql).toMatch(/\("safeVerdict" IS NULL OR "safeVerdict" NOT IN \(\$\d+,\$\d+,\$\d+\)\)/);
    expect(query.values).toEqual([new Date(NOW), 9, new Date(NOW), 'malware', 'phishing', 'unwanted']);
  });

  it('wins only when exactly one row changed', async () => {
    expect(await claimOneTime(db(1), 9, NOW)).toBe(true);
    expect(await claimOneTime(db(0), 9, NOW)).toBe(false);
  });
});
