import { describe, it, expect } from 'vitest';

process.env.SECRET_KEY = 'test-secret-key-that-is-32-chars!';

const { hashApiKey, generateApiKey } = await import('./auth.js');

describe('generateApiKey', () => {
  it('returns an object with raw key, hash, and preview', () => {
    const result = generateApiKey();
    expect(result.raw).toMatch(/^ik_/);
    expect(result.hash).toHaveLength(64); // SHA-256 hex
    expect(result.preview).toMatch(/^ik_.+\.\.\./);
  });

  it('generates different keys each time', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('hashApiKey', () => {
  it('produces consistent hash for same input', () => {
    const hash1 = hashApiKey('ik_testkey123');
    const hash2 = hashApiKey('ik_testkey123');
    expect(hash1).toBe(hash2);
  });

  it('matches the hash from generateApiKey', () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });
});
