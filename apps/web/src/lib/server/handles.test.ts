import { describe, it, expect } from 'vitest';
import { validateHandle, RESERVED } from './handles';

describe('validateHandle', () => {
  it('accepts 3-30 chars of [a-z0-9-]', () => {
    expect(validateHandle('abc').ok).toBe(true);
    expect(validateHandle('a'.repeat(30)).ok).toBe(true);
  });

  // New handles must be valid subdomain labels, so every profile can have
  // <handle>.iksi.app.
  it('accepts a hyphenated handle', () => {
    expect(validateHandle('ann-reyes-9')).toEqual({ ok: true, handle: 'ann-reyes-9' });
  });

  it('rejects an underscore', () => {
    expect(validateHandle('ann_reyes')).toEqual({ ok: false, error: 'Use letters, numbers and hyphens. No underscores.' });
    expect(validateHandle('a-b_c-9').ok).toBe(false);
  });

  it.each(['-ann', 'ann-', '-ann-'])('rejects %s, with a leading or trailing hyphen', (h) => {
    expect(validateHandle(h)).toEqual({ ok: false, error: "A handle can't start or end with a hyphen." });
  });

  it('rejects too short / too long', () => {
    expect(validateHandle('ab').ok).toBe(false);
    expect(validateHandle('a'.repeat(31)).ok).toBe(false);
  });

  it('rejects invalid chars', () => {
    expect(validateHandle('AbC').ok).toBe(false);
    expect(validateHandle('a.b').ok).toBe(false);
    expect(validateHandle('a b').ok).toBe(false);
    expect(validateHandle('a@b').ok).toBe(false);
  });

  it('rejects reserved handles', () => {
    for (const r of RESERVED) {
      expect(validateHandle(r).ok).toBe(false);
    }
  });

  it.each([
    'www', 'admin', 'api', 'cdn', 'app', 'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2',
    'status', 'blog', 'docs', 'help', 'support', 'static', 'assets', 'media', 'dev', 'staging', 'test',
    'beta', 'auth', 'login', 'dashboard'
  ])('rejects %s, which would shadow a hostname, as reserved', (h) => {
    expect(validateHandle(h)).toEqual({ ok: false, error: 'That handle is reserved' });
  });

  it('rejects empty / null-ish', () => {
    expect(validateHandle('').ok).toBe(false);
    expect(validateHandle(undefined as any).ok).toBe(false);
  });
});
