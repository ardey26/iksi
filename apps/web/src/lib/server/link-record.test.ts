import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseLinkRecord } from '@iksi/core';
import { toLinkRecord } from './link-record';

const row = (over: Record<string, unknown> = {}) => ({
  id: 3,
  safeVerdict: null,
  rules: null,
  expiresAt: null,
  expiredAt: null,
  passwordHash: null,
  permanent: false,
  ...over
});

const rule = { id: 'rule0001', when: { devices: ['mobile'] }, destination: 'https://m.e.com' };

afterEach(() => vi.restoreAllMocks());

describe('toLinkRecord', () => {
  it('flags malicious verdicts', () => {
    expect(toLinkRecord(row({ safeVerdict: 'phishing' }), 'https://e.com')).toMatchObject({
      v: 1,
      id: 3,
      destination: 'https://e.com',
      flagged: true,
      permanent: false
    });
  });

  it.each([null, 'safe', 'pending'])('does not flag %s', (verdict) => {
    const rec = toLinkRecord(row({ id: 1, safeVerdict: verdict }), 'https://e.com');
    expect(rec.flagged).toBe(false);
    expect(parseLinkRecord(rec)).not.toBeNull();
  });

  it('maps each column', () => {
    const when = new Date(1_800_000_000_000);
    const rec = toLinkRecord(
      row({ rules: [rule], expiresAt: when, expiredAt: new Date(), permanent: true }),
      'https://e.com'
    );
    expect(rec).toMatchObject({
      permanent: true,
      rules: [rule],
      expiresAt: 1_800_000_000_000,
      expired: true,
      protected: false
    });
    expect(parseLinkRecord(rec)).toEqual(rec);
  });

  it('leaves expiry unset and not expired by default', () => {
    expect(toLinkRecord(row(), 'https://e.com')).toMatchObject({
      rules: [],
      expiresAt: null,
      expired: false,
      protected: false
    });
  });

  it('invalid rules JSON becomes [] and is logged', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rec = toLinkRecord(row({ rules: [{ nope: 1 }] }), 'https://e.com');
    expect(rec.rules).toEqual([]);
    expect(err).toHaveBeenCalled();
  });

  it('a password hash makes the link protected without leaking the hash', () => {
    const rec = toLinkRecord(row({ passwordHash: 'scrypt$secret' }), 'https://e.com');
    expect(rec.protected).toBe(true);
    expect(JSON.stringify(rec)).not.toContain('scrypt$secret');
  });
});
