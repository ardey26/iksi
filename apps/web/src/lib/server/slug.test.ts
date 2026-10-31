import { describe, it, expect } from 'vitest';
import { generateSlug } from './slug';

describe('generateSlug', () => {
  it('returns a 6-char base62 string', () => {
    const s = generateSlug();
    expect(s).toMatch(/^[0-9A-Za-z]{6}$/);
  });

  it('returns different values across calls', () => {
    const set = new Set(Array.from({ length: 100 }, () => generateSlug()));
    expect(set.size).toBeGreaterThan(95);
  });
});
