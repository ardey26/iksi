import { describe, it, expect } from 'vitest';
import { generatePKCE, generateState, buildAuthorizeURL, verifyState } from './google-oauth';

describe('google-oauth generatePKCE', () => {
  it('returns a 43-128 char verifier and a base64url-encoded challenge', () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain('=');
  });
});

describe('google-oauth generateState', () => {
  it('returns a 32-hex-char CSRF token', () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('google-oauth verifyState', () => {
  it('accepts a match and rejects a mismatch/empty', () => {
    expect(verifyState('abc', 'abc')).toBe(true);
    expect(verifyState('abc', 'def')).toBe(false);
    expect(verifyState('abc', '')).toBe(false);
    expect(verifyState('', 'abc')).toBe(false);
    expect(verifyState(undefined, 'abc')).toBe(false);
  });
});

describe('google-oauth buildAuthorizeURL', () => {
  it('assembles Google authorize URL with all required params', () => {
    const url = buildAuthorizeURL({
      clientId: 'CID',
      redirectUri: 'https://iksi.test/auth/google/callback',
      state: 'STATE',
      codeChallenge: 'CHALLENGE'
    });
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=CID');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fiksi.test%2Fauth%2Fgoogle%2Fcallback');
    expect(url).toContain('state=STATE');
    expect(url).toContain('code_challenge=CHALLENGE');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid+email+profile');
  });
});
