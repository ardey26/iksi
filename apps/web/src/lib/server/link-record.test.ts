import { describe, it, expect, vi, afterEach } from 'vitest';
import { decideLink, parseLinkRecord } from '@iksi/core';
import { destinationsOf, toLinkRecord } from './link-record';

const row = (over: Record<string, unknown> = {}) => ({
  id: 3,
  safeVerdict: null,
  rules: null,
  expiresAt: null,
  expiredAt: null,
  passwordHash: null,
  permanent: false,
  clickCount: 0,
  maxClicks: null,
  oneTime: false,
  ...over
});

const rule = { id: 'rule0001', when: { devices: ['mobile'] }, destination: 'https://m.e.com' };

afterEach(() => vi.restoreAllMocks());

describe('toLinkRecord', () => {
  it('flags malicious verdicts', () => {
    expect(toLinkRecord(row({ safeVerdict: 'phishing' }), 'https://e.com')).toMatchObject({
      v: 2,
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

  it.each([
    [5, 5],
    [6, 5]
  ])('%i clicks against a cap of %i is expired before ingest marks expiredAt', (clickCount, maxClicks) => {
    expect(toLinkRecord(row({ clickCount, maxClicks }), 'https://e.com').expired).toBe(true);
  });

  it('clicks under the cap, or no cap, is not expired', () => {
    expect(toLinkRecord(row({ clickCount: 4, maxClicks: 5 }), 'https://e.com').expired).toBe(false);
    expect(toLinkRecord(row({ clickCount: 99, maxClicks: null }), 'https://e.com').expired).toBe(false);
  });

  it('a cap raised past the click count revives a click-expired link', () => {
    // validateSettings clears expiredAt when the cap is raised; the record must follow.
    expect(toLinkRecord(row({ clickCount: 5, maxClicks: 10 }), 'https://e.com').expired).toBe(false);
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

describe('toLinkRecord for a one-time link', () => {
  const now = 1_700_000_000_000;

  it('is never a plain redirect, so the edge always passes it to the origin', () => {
    const rec = toLinkRecord(row({ oneTime: true }), 'https://secret.example/');
    const parsed = parseLinkRecord(JSON.parse(JSON.stringify(rec)));
    expect(parsed).not.toBeNull();
    expect(decideLink(parsed!, now)).not.toBe('redirect');
    expect(rec.protected).toBe(true);
  });

  it('keeps the version, so no Worker needs a new record format', () => {
    expect(toLinkRecord(row({ oneTime: true }), 'https://secret.example/').v).toBe(2);
  });

  it('never carries the secret destination to the edge store', () => {
    const rec = toLinkRecord(row({ oneTime: true }), 'https://secret.example/token');
    expect(JSON.stringify(rec)).not.toContain('secret.example');
  });

  it('still reports flagged and expired so the origin page is right', () => {
    expect(decideLink(toLinkRecord(row({ oneTime: true, safeVerdict: 'malware' }), ''), now)).toBe('flagged');
    expect(
      decideLink(toLinkRecord(row({ oneTime: true, expiresAt: new Date(now - 1) }), ''), now)
    ).toBe('expired');
  });

  it('an opened one-time link is never a redirect either', () => {
    const rec = toLinkRecord(row({ oneTime: true, openedAt: new Date(now - 1) }), '');
    expect(decideLink(parseLinkRecord(rec)!, now)).not.toBe('redirect');
  });
});

describe('destinationsOf', () => {
  it('lists the default, each rule destination and each split destination once', () => {
    const rules = [
      { id: 'rule0001', when: { devices: ['mobile'] }, destination: 'https://m.e.com/' },
      {
        id: 'rule0002',
        when: {},
        split: [
          { destination: 'https://a.e.com/', weight: 50 },
          { destination: 'https://e.com/', weight: 50 }
        ]
      },
      { id: 'rule0003', when: { os: ['ios'] }, destination: 'https://m.e.com/' }
    ];
    expect(destinationsOf('https://e.com/', rules)).toEqual([
      'https://e.com/',
      'https://m.e.com/',
      'https://a.e.com/'
    ]);
  });

  it('is only the default with no rules or unparseable rules', () => {
    expect(destinationsOf('https://e.com/', null)).toEqual(['https://e.com/']);
    expect(destinationsOf('https://e.com/', [{ nope: 1 }])).toEqual(['https://e.com/']);
  });
});
