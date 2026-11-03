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

// --- Readability: the palette's tokens converted to sRGB, measured by WCAG 2 contrast. ---
// An independent OKLab implementation (Ottosson's matrices), not the module's.

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The hue, in radians, that `oklch(from <hex> ...)` takes from the accent. */
function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Math.atan2(0.0259040371 * l + 0.782771766 * m - 0.808675766 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s);
}

/** Relative luminance of oklch(L C h), clipped into sRGB the way browsers render it. */
function luminance(L: number, C: number, h: number): number {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

const contrast = (y1: number, y2: number) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);

/** Luminance of a token like `oklch(from #3B82F6 0.62 0.018 h)`. */
function tokenLuminance(token: string): number {
  const m = /^oklch\(from (#[0-9a-fA-F]{6}) ([\d.]+) ([\d.]+) h\)$/.exec(token);
  if (!m) throw new Error(`not a plain relative oklch token: ${token}`);
  return luminance(Number(m[2]), Number(m[3]), hueOf(m[1]));
}

const ACCENTS = { blue: '#3B82F6', red: '#EF4444', green: '#22C55E', yellow: '#EAB308', grey: '#71717A' };
const ALL = Array.from({ length: 101 }, (_, i) => i);

describe('the measuring tools', () => {
  it('agree with known values', () => {
    expect(luminance(1, 0, 0)).toBeCloseTo(1, 4);
    expect(luminance(0, 0, 0)).toBeCloseTo(0, 6);
    expect(contrast(1, 0)).toBeCloseTo(21, 4);
    expect((hueOf('#3B82F6') * 180) / Math.PI + 360).toBeCloseTo(259.8, 0);
    // #777777 is the classic 4.48:1 grey on white.
    const grey = toLinear(0x77 / 255);
    expect(contrast(1, grey)).toBeCloseTo(4.48, 2);
  });
});

describe('palette readability', () => {
  /** The weaker of a text token's contrasts against --bg and --surface. */
  function worstContrast(tokens: Record<string, string>, text: string): number {
    const t = tokenLuminance(tokens[text]);
    return Math.min(contrast(t, tokenLuminance(tokens['--bg'])), contrast(t, tokenLuminance(tokens['--surface'])));
  }

  it.each(Object.entries(ACCENTS))('%s: muted text reaches 4.5:1 on bg and surface at every brightness', (_name, hex) => {
    for (const b of ALL) {
      const { tokens } = profilePalette(hex, String(b));
      expect(worstContrast(tokens, '--text-muted'), `brightness ${b}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(Object.entries(ACCENTS))('%s: primary text reads at least as well as muted', (_name, hex) => {
    for (const b of ALL) {
      const { tokens } = profilePalette(hex, String(b));
      const primary = worstContrast(tokens, '--text-primary');
      expect(primary, `brightness ${b}`).toBeGreaterThanOrEqual(4.5);
      expect(primary, `brightness ${b}`).toBeGreaterThanOrEqual(worstContrast(tokens, '--text-muted') - 0.05);
    }
  });

  it('changes only the text on dark profiles', () => {
    for (const b of ALL.slice(0, 51)) {
      const { scheme, tokens } = profilePalette('#3B82F6', String(b));
      const bL = Math.max(0.04, b / 100);
      expect(scheme).toBe('dark');
      expect(tokens['--bg']).toBe(`oklch(from #3B82F6 ${Math.round(bL * 1000) / 1000} 0.020 h)`);
      expect(tokens['--surface']).toBe(`oklch(from #3B82F6 ${Math.round((bL + 0.03) * 1000) / 1000} 0.014 h)`);
    }
  });

  it('keeps the light palette from 57 up, where dark text can reach AA', () => {
    for (const b of ALL.slice(57)) expect(profilePalette('#3B82F6', String(b)).scheme).toBe('light');
  });
});
