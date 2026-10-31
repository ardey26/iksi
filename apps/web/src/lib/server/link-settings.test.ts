import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';

vi.mock('#lib/server/crypto.js', () => ({ encodeURL: vi.fn((u: string) => `enc:${u}`) }));

import { validateSettings } from './link-settings';

const NOW = Date.UTC(2026, 10, 1, 12, 0);
const current = { clickCount: 5 };
const run = (input: object, c = current) => validateSettings(input, c, NOW);
const fail = async (input: object, c = current) => {
  const r = await run(input, c);
  if (r.ok) throw new Error('expected rejection');
  return r.error;
};
const pass = async (input: object, c = current) => {
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
});
