import { describe, it, expect, beforeAll } from 'vitest';
import { createUserSession, verifyUserSession } from './user-auth';

beforeAll(() => {
  process.env.SECRET_KEY = 'x'.repeat(32);
});

describe('createUserSession + verifyUserSession', () => {
  it('round-trips a userId', () => {
    const tok = createUserSession(42);
    expect(verifyUserSession(tok)).toBe(42);
  });

  it('rejects tampered token', () => {
    const tok = createUserSession(1);
    const tampered = tok.replace(/^1\./, '2.');
    expect(verifyUserSession(tampered)).toBeNull();
  });

  it('rejects empty / malformed', () => {
    expect(verifyUserSession('')).toBeNull();
    expect(verifyUserSession('abc')).toBeNull();
    expect(verifyUserSession('1.abc')).toBeNull();
  });

  it('rejects expired token', () => {
    const tok = createUserSession(1, -60);
    expect(verifyUserSession(tok)).toBeNull();
  });
});
