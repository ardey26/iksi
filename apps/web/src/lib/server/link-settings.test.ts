import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));

import { validateSettings } from './link-settings';

const NOW = Date.UTC(2026, 10, 1, 12, 0);
const current = { clickCount: 5 };
type Cur = { clickCount: number; destination?: string; expiresAt?: Date | null; maxClicks?: number | null };
const run = (input: object, c: Cur = current) => validateSettings(input, c, NOW);
const fail = async (input: object, c: Cur = current) => {
  const r = await run(input, c);
  if (r.ok) throw new Error('expected rejection');
  return r.error;
};
const pass = async (input: object, c: Cur = current) => {
  const r = await run(input, c);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('validateSettings', () => {
  it('prefixes a destination without a scheme, encodes it and marks the verdict pending', async () => {
    const r = await pass({ destination: ' example.com/x ' });
    expect(r.data.originalURL).toBe('enc:https://example.com/x');
    expect(r.data.safeVerdict).toBe('pending');
    expect(r.destinationChanged).toBe('https://example.com/x');
  });

  it('leaves the verdict alone when the destination is absent', async () => {
    const r = await pass({ permanent: true });
    expect(r.data).not.toHaveProperty('originalURL');
    expect(r.data).not.toHaveProperty('safeVerdict');
    expect(r.destinationChanged).toBeNull();
    expect(r.data.permanent).toBe(true);
  });

  it('rejects localhost and over-long destinations', async () => {
    expect(await fail({ destination: 'http://localhost:3000' })).toMatch(/valid URL/i);
    expect(await fail({ destination: 'https://e.com/' + 'a'.repeat(2048) })).toMatch(/2048/);
  });

  it('stores valid rules', async () => {
    const rules = [{ id: 'rule-aaa', when: { countries: ['SG'] }, destination: 'https://a.example.com/' }];
    const r = await pass({ rules });
    expect(r.data.rules).toEqual(rules);
  });

  it('rejects a rule destination that fails server validation, naming the position', async () => {
    const rules = [
      { id: 'rule-aaa', when: { countries: ['SG'] }, destination: 'https://a.example.com/' },
      { id: 'rule-bbb', when: { countries: ['US'] }, destination: 'https://iksi.app/abc' }
    ];
    expect(await fail({ rules })).toBe('Rule 2: enter a valid URL');
  });

  it('rejects a split destination that fails server validation', async () => {
    const rules = [
      {
        id: 'rule-aaa',
        when: {},
        split: [
          { destination: 'https://a.example.com/', weight: 50 },
          { destination: 'https://intranet', weight: 50 }
        ]
      }
    ];
    expect(await fail({ rules })).toBe('Rule 1: enter a valid URL');
  });

  it('rejects malformed rules via parseRules', async () => {
    expect(await fail({ rules: 'nope' })).toMatch(/array/i);
  });

  it('rejects an expiry in the past, accepts the future, and clears expiredAt', async () => {
    expect(await fail({ expiresAt: new Date(NOW - 1000).toISOString() })).toMatch(/future/i);
    expect(await fail({ expiresAt: 'garbage' })).toMatch(/date/i);
    const r = await pass({ expiresAt: new Date(NOW + 1000).toISOString() });
    expect(r.data.expiresAt).toEqual(new Date(NOW + 1000));
    expect(r.data.expiredAt).toBeNull();
  });

  it('rejects maxClicks at or below the current click count', async () => {
    expect(await fail({ maxClicks: 5 })).toMatch(/more than/i);
    expect(await fail({ maxClicks: 1.5 })).toMatch(/whole/i);
    const r = await pass({ maxClicks: 6 });
    expect(r.data.maxClicks).toBe(6);
  });

  it('clearing expiry or max clicks also clears expiredAt', async () => {
    const a = await pass({ maxClicks: null });
    expect(a.data).toMatchObject({ maxClicks: null, expiredAt: null });
    const b = await pass({ expiresAt: null });
    expect(b.data).toMatchObject({ expiresAt: null, expiredAt: null });
  });

  it('rejects a 3 character password and a 129 character one', async () => {
    expect(await fail({ password: 'abc' })).toMatch(/4 to 128/);
    expect(await fail({ password: 'a'.repeat(129) })).toMatch(/4 to 128/);
  });

  it('hashes a password with bcrypt', async () => {
    const r = await pass({ password: 'hunter22' });
    expect(typeof r.data.passwordHash).toBe('string');
    expect(await bcrypt.compare('hunter22', r.data.passwordHash as string)).toBe(true);
  });

  it('password null removes it, absent leaves it alone', async () => {
    expect((await pass({ password: null })).data.passwordHash).toBeNull();
    expect(await pass({ permanent: false })).toSatisfy((r: { data: object }) => !('passwordHash' in r.data));
  });

  it.each([
    [0, false],
    [1000000001, false],
    [5000000000, false]
  ])('rejects maxClicks %s outside 1 to 1,000,000,000', async (n) => {
    expect(await fail({ maxClicks: n }, { clickCount: 0 })).toBe('Max clicks must be between 1 and 1,000,000,000');
  });

  it.each([1, 1000000000])('accepts maxClicks %s', async (n) => {
    expect((await pass({ maxClicks: n }, { clickCount: 0 })).data.maxClicks).toBe(n);
  });

  it('treats an unchanged destination as no change', async () => {
    const r = await pass({ destination: 'example.com/x' }, { clickCount: 5, destination: 'https://example.com/x' });
    expect(r.data).not.toHaveProperty('originalURL');
    expect(r.data).not.toHaveProperty('safeVerdict');
    expect(r.destinationChanged).toBeNull();
    const c = await pass({ destination: 'example.com/y' }, { clickCount: 5, destination: 'https://example.com/x' });
    expect(c.destinationChanged).toBe('https://example.com/y');
  });

  it('words a too-long rule destination without mangling it', async () => {
    const rules = [{ id: 'rule-aaa', when: {}, destination: 'https://e.com/' + 'a'.repeat(2048) }];
    expect(await fail({ rules })).toBe('Rule 1: destination must be at most 2048 characters');
  });

  describe('expiredAt revival', () => {
    const past = new Date(NOW - 1000);
    it('keeps expiredAt when only maxClicks changes on a date-expired link', async () => {
      const r = await pass({ maxClicks: 6 }, { clickCount: 5, expiresAt: past });
      expect(r.data).not.toHaveProperty('expiredAt');
    });
    it('clears expiredAt when expiresAt moves to the future and no click limit is exhausted', async () => {
      const r = await pass({ expiresAt: new Date(NOW + 5000).toISOString() }, { clickCount: 5, expiresAt: past, maxClicks: 50 });
      expect(r.data.expiredAt).toBeNull();
    });
    it('keeps expiredAt when the stored click limit is still exhausted', async () => {
      const r = await pass({ expiresAt: new Date(NOW + 5000).toISOString() }, { clickCount: 5, maxClicks: 5 });
      expect(r.data).not.toHaveProperty('expiredAt');
    });
    it('raising maxClicks on a click-expired link revives it', async () => {
      const r = await pass({ maxClicks: 10 }, { clickCount: 5, maxClicks: 5 });
      expect(r.data).toMatchObject({ maxClicks: 10, expiredAt: null });
    });
    it('clears expiredAt when both limits are cleared', async () => {
      const r = await pass({ expiresAt: null, maxClicks: null }, { clickCount: 5, expiresAt: past, maxClicks: 5 });
      expect(r.data.expiredAt).toBeNull();
    });
  });
});
