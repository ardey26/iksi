import { describe, it, expect } from 'vitest';
import { isValidUsername, normalizeUsername, RESERVED_USERNAMES } from './username.js';

describe('normalizeUsername', () => {
  it('converts to lowercase', () => {
    expect(normalizeUsername('JohnDoe')).toBe('johndoe');
  });

  it('trims whitespace', () => {
    expect(normalizeUsername('  alice  ')).toBe('alice');
  });
});

describe('isValidUsername', () => {
  it('accepts valid usernames', () => {
    expect(isValidUsername('alice')).toEqual({ valid: true });
    expect(isValidUsername('john-doe')).toEqual({ valid: true });
    expect(isValidUsername('user123')).toEqual({ valid: true });
    expect(isValidUsername('123user')).toEqual({ valid: true });
    expect(isValidUsername('a-b-c')).toEqual({ valid: true });
  });

  it('rejects usernames shorter than 3 characters', () => {
    const result = isValidUsername('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('3');
  });

  it('rejects usernames longer than 20 characters', () => {
    const result = isValidUsername('a'.repeat(21));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('20');
  });

  it('rejects usernames starting with hyphen', () => {
    const result = isValidUsername('-alice');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('rejects usernames ending with hyphen', () => {
    const result = isValidUsername('alice-');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('hyphen');
  });

  it('rejects consecutive hyphens', () => {
    const result = isValidUsername('alice--bob');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('consecutive');
  });

  it('rejects invalid characters', () => {
    expect(isValidUsername('alice_bob').valid).toBe(false);
    expect(isValidUsername('alice.bob').valid).toBe(false);
    expect(isValidUsername('alice@bob').valid).toBe(false);
  });

  it('rejects reserved usernames', () => {
    const result = isValidUsername('admin');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reserved');
  });

  it('rejects reserved usernames case-insensitively', () => {
    const result = isValidUsername('ADMIN');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reserved');
  });
});

describe('RESERVED_USERNAMES', () => {
  it('includes common reserved names', () => {
    expect(RESERVED_USERNAMES).toContain('admin');
    expect(RESERVED_USERNAMES).toContain('www');
    expect(RESERVED_USERNAMES).toContain('api');
  });
});
