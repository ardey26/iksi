import { describe, it, expect } from 'vitest';
import { generatePKCE, generateState, buildAuthorizeURL, verifyState } from './twitter-oauth';

describe('generatePKCE', () => {
  it('returns a 43-128 char verifier and a base64url-encoded challenge', () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain('=');
  });
});

describe('generateState', () => {
  it('returns a 32-hex-char CSRF token', () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('verifyState', () => {
  it('accepts a match and rejects a mismatch/empty', () => {
    expect(verifyState('abc', 'abc')).toBe(true);
    expect(verifyState('abc', 'def')).toBe(false);
    expect(verifyState('abc', '')).toBe(false);
    expect(verifyState('', 'abc')).toBe(false);
    expect(verifyState(undefined, 'abc')).toBe(false);
  });
});

describe('buildAuthorizeURL', () => {
  it('assembles Twitter authorize URL with all required params', () => {
    const url = buildAuthorizeURL({
      clientId: 'CID',
      redirectUri: 'https://x.test/cb',
      state: 'STATE',
      codeChallenge: 'CHALLENGE'
    });
    expect(url).toContain('https://twitter.com/i/oauth2/authorize');
    expect(url).toContain('client_id=CID');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fx.test%2Fcb');
    expect(url).toContain('state=STATE');
    expect(url).toContain('code_challenge=CHALLENGE');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=users.read+tweet.read+offline.access');
  });
});
