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

export function profilePalette(accentIn: string | null | undefined, theme: string | null | undefined): ProfilePalette {
  // The accent lands in inline styles and in CSS the extension applies: only #RRGGBB.
  const accent = accentIn && HEX.test(accentIn) ? accentIn : DEFAULT_ACCENT;
  const bL = Math.max(0.04, Math.min(0.99, brightnessOf(theme) / 100));
  const isLight = bL > 0.5;
  const sL = Math.min(1, bL + (isLight ? 0.025 : 0.03));
  const tL = isLight ? Math.max(0.14, 0.94 - bL) : Math.min(0.94, bL + 0.75);
  const mL = isLight ? Math.max(0.38, bL - 0.3) : Math.min(0.72, bL + 0.38);
  const brL = isLight ? Math.max(0.8, bL - 0.1) : Math.min(0.32, bL + 0.14);
  const accentReadableL = isLight ? 0.48 : 0.72;

  const ok = (l: number, c: string) => `oklch(from ${accent} ${fmt(l)} ${c} h)`;
  const tokens: Record<string, string> = {
    '--accent': accent,
    '--accent-text': ok(accentReadableL, 'max(c, 0.09)'),
    '--bg': ok(bL, '0.020'),
    '--surface': ok(sL, '0.014'),
    '--border': ok(brL, '0.050'),
    '--text-primary': ok(tL, '0.008'),
    '--text-muted': ok(mL, '0.018'),
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
