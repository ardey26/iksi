/**
 * A profile's palette, derived from its accent and brightness. The single
 * source for the public profile, the dashboard preview and /api/me/profile.
 * Every colour is `oklch(from <accent> L C h)`: the accent gives the hue, the
 * brightness gives the lightness, so the palette reads the same on any hue.
 * Universal: the dashboard preview recomputes it as the slider moves.
 */

export const DEFAULT_ACCENT = '#3B82F6';
const HEX = /^#[0-9a-fA-F]{6}$/;

export type PaletteScheme = 'dark' | 'light';
export type ProfilePalette = { scheme: PaletteScheme; tokens: Record<string, string> };

/** `theme` stores brightness as "0".."100"; legacy 'light' is 100, anything else 20. */
export function brightnessOf(theme: string | null | undefined): number {
  if (!theme) return 20;
  const n = parseInt(theme, 10);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  if (theme === 'light') return 100;
  return 20;
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

// --- Readable text ---------------------------------------------------------
// Muted and primary text must reach WCAG AA (4.5:1) on --bg and on --surface.
// Contrast is measured on the colour the browser renders: oklch with the
// accent's hue, clipped into sRGB. The hue is unknown here (only the CSS
// knows the accent), so a lightness passes only if it passes for every hue.

/** Solved a little above 4.5:1 so hue sampling and 8-bit rendering cannot drop below it. */
const SOLVE_TARGET = 4.6;
const BG_C = 0.02;
const SURFACE_C = 0.014;
const TEXT_C = 0.008;
const MUTED_C = 0.018;
const HUES = Array.from({ length: 72 }, (_, i) => (i * 5 * Math.PI) / 180);

/** WCAG relative luminance of oklch(L C h), clipped into sRGB. */
function luminance(L: number, C: number, h: number): number {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return (
    0.2126 * clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) +
    0.7152 * clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) +
    0.0722 * clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  );
}

type Back = readonly [L: number, C: number];

/** The weakest contrast of text at (L, C) on any of `backs`, over every hue. */
function worstContrast(L: number, C: number, backs: readonly Back[]): number {
  let worst = Infinity;
  for (const h of HUES) {
    const t = luminance(L, C, h);
    for (const [bl, bc] of backs) {
      const y = luminance(bl, bc, h);
      worst = Math.min(worst, (Math.max(t, y) + 0.05) / (Math.min(t, y) + 0.05));
    }
  }
  return worst;
}

/**
 * The text lightness nearest `start` that reads on `backs`, moving toward
 * black (dir -1) or white (dir 1). `start` is kept when it already passes.
 * Next to pure white or black the tint itself costs contrast, so it is dropped
 * when even the end of the range would not pass with it.
 */
function readable(start: number, dir: -1 | 1, C: number, backs: readonly Back[]): { L: number; C: number } {
  if (worstContrast(start, C, backs) >= SOLVE_TARGET) return { L: start, C };
  const end = dir < 0 ? 0 : 1;
  if (worstContrast(end, C, backs) < SOLVE_TARGET) return C > 0 ? readable(start, dir, 0, backs) : { L: end, C };
  let pass = end;
  let fail = start;
  for (let i = 0; i < 20; i++) {
    const mid = (pass + fail) / 2;
    if (worstContrast(mid, C, backs) >= SOLVE_TARGET) pass = mid;
    else fail = mid;
  }
  // Rounded the way the token is written, toward the safe side.
  return { L: dir < 0 ? Math.floor(pass * 1000) / 1000 : Math.ceil(pass * 1000) / 1000, C };
}

type Levels = {
  isLight: boolean;
  bL: number;
  sL: number;
  brL: number;
  text: { L: number; C: number };
  muted: { L: number; C: number };
};

const levelCache = new Map<number, Levels>();

function levelsFor(brightness: number): Levels {
  const cached = levelCache.get(brightness);
  if (cached) return cached;

  const bL = Math.max(0.04, Math.min(0.99, brightness / 100));
  const lightSurface = Math.min(1, bL + 0.025);
  // Past the midpoint the page turns light, but just past it no dark text can
  // reach AA on that mid grey. There the text stays light, and the surface
  // steps down instead of up so light text still reads on it.
  const isLight = bL > 0.5 && worstContrast(0, MUTED_C, [[bL, BG_C], [lightSurface, SURFACE_C]]) >= SOLVE_TARGET;
  const sL = isLight ? lightSurface : bL > 0.5 ? bL - 0.03 : Math.min(1, bL + 0.03);
  const brL = isLight ? Math.max(0.8, bL - 0.1) : Math.min(0.32, bL + 0.14);

  const backs: Back[] = [[bL, BG_C], [sL, SURFACE_C]];
  const dir = isLight ? -1 : 1;
  const muted = readable(isLight ? Math.max(0.38, bL - 0.3) : Math.min(0.72, bL + 0.38), dir, MUTED_C, backs);
  const text = readable(isLight ? Math.max(0.14, 0.94 - bL) : Math.min(0.94, bL + 0.75), dir, TEXT_C, backs);
  // Primary text never reads weaker than muted text.
  text.L = isLight ? Math.min(text.L, muted.L) : Math.max(text.L, muted.L);

  const levels = { isLight, bL, sL, brL, text, muted };
  levelCache.set(brightness, levels);
  return levels;
}

export function profilePalette(accentIn: string | null | undefined, theme: string | null | undefined): ProfilePalette {
  // The accent lands in inline styles and in CSS the extension applies: only #RRGGBB.
  const accent = accentIn && HEX.test(accentIn) ? accentIn : DEFAULT_ACCENT;
  const { isLight, bL, sL, brL, text, muted } = levelsFor(brightnessOf(theme));
  const tL = text.L;
  const mL = muted.L;
  const accentReadableL = isLight ? 0.48 : 0.72;

  const ok = (l: number, c: string) => `oklch(from ${accent} ${fmt(l)} ${c} h)`;
  const tokens: Record<string, string> = {
    '--accent': accent,
    '--accent-text': ok(accentReadableL, 'max(c, 0.09)'),
    '--bg': ok(bL, '0.020'),
    '--surface': ok(sL, '0.014'),
    '--border': ok(brL, '0.050'),
    '--text-primary': ok(tL, fmt(text.C)),
    '--text-muted': ok(mL, fmt(muted.C)),
    // The UI kit's remaining tokens, from the same palette, so kit components
    // (rows, buttons, the pay sheet) match the owner's colours.
    '--surface-2': ok(isLight ? Math.max(0, sL - 0.02) : Math.min(1, sL + 0.03), '0.014'),
    '--skeleton': ok(isLight ? Math.max(0, sL - 0.05) : Math.min(1, sL + 0.06), '0.014'),
    '--border-strong': ok(isLight ? Math.max(0, brL - 0.08) : Math.min(1, brL + 0.08), '0.050'),
    '--text-faint': ok(isLight ? Math.min(0.62, mL + 0.1) : Math.max(0.5, mL - 0.1), '0.018'),
    '--track': ok(isLight ? Math.max(0, sL - 0.03) : Math.min(1, sL + 0.03), '0.014'),
    '--thumb': 'var(--surface)',
    '--paper-shadow': isLight
      ? '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.04)'
      : 'inset 0 1px 0 rgb(255 255 255 / 0.04)',
    '--overlay-shadow': isLight ? '0 24px 64px rgb(0 0 0 / 0.16)' : '0 24px 64px rgb(0 0 0 / 0.6)',
    '--scrim': isLight ? 'rgb(9 9 11 / 0.32)' : 'rgb(0 0 0 / 0.64)'
  };
  return { scheme: isLight ? 'light' : 'dark', tokens };
}

/** The palette as inline style declarations, ending with its color-scheme. */
export function paletteCss(p: ProfilePalette): string {
  return Object.entries(p.tokens)
    .map(([k, v]) => `${k}: ${v};`)
    .concat(`color-scheme: ${p.scheme};`)
    .join(' ');
}
