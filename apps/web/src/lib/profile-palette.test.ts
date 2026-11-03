import { describe, it, expect } from 'vitest';
import { brightnessOf, paletteCss, profilePalette } from './profile-palette';

describe('brightnessOf', () => {
  it.each([
    [null, 20],
    ['default', 20],
    ['dark', 20],
    ['light', 100],
    ['0', 0],
    ['55', 55],
    ['140', 100],
    ['-3', 0]
  ])('reads %j as %d', (theme, b) => {
    expect(brightnessOf(theme)).toBe(b);
  });
});

describe('profilePalette', () => {
  it('derives every token from the accent by relative color syntax', () => {
    const { tokens } = profilePalette('#3B82F6', '20');
    expect(tokens['--accent']).toBe('#3B82F6');
    for (const [name, value] of Object.entries(tokens)) {
      if (name === '--accent' || name === '--thumb' || /shadow|scrim/.test(name)) continue;
      expect(value, name).toMatch(/^oklch\(from #3B82F6 [\d.]+ (?:[\d.]+|max\(c, [\d.]+\)) h\)$/);
    }
  });

  it('keeps the dark background at the chosen brightness', () => {
    const p = profilePalette('#3B82F6', '20');
    expect(p.scheme).toBe('dark');
    expect(p.tokens['--bg']).toBe('oklch(from #3B82F6 0.2 0.020 h)');
    expect(p.tokens['--surface']).toBe('oklch(from #3B82F6 0.23 0.014 h)');
  });

  it('keeps the light background at the chosen brightness', () => {
    const p = profilePalette('#3B82F6', '90');
    expect(p.scheme).toBe('light');
    expect(p.tokens['--bg']).toBe('oklch(from #3B82F6 0.9 0.020 h)');
    expect(p.tokens['--surface']).toBe('oklch(from #3B82F6 0.925 0.014 h)');
  });

  it('falls back to the default accent for anything that is not #RRGGBB', () => {
    const p = profilePalette('red; background: url(x)', '20');
    expect(p.tokens['--accent']).toBe('#3B82F6');
    expect(JSON.stringify(p.tokens)).not.toContain('url(');
  });

  it('writes the tokens and color-scheme as one inline style', () => {
    const css = paletteCss(profilePalette('#22C55E', '90'));
    expect(css).toContain('--bg: oklch(from #22C55E 0.9 0.020 h);');
    expect(css).toContain('--surface-2:');
    expect(css.trim().endsWith('color-scheme: light;')).toBe(true);
  });
});
