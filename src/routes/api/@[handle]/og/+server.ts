import type { RequestHandler } from './$types';
import { ImageResponse } from '@vercel/og';
import { normalizeAvatarUrl } from '$lib/server/avatar-url';

// --- Color helpers: derive a soft palette from the user's accent + brightness ---

function hexToHsl(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, sat * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const S = Math.max(0, Math.min(100, s)) / 100;
  const L = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function brightnessOf(t: string | null | undefined): number {
  if (!t) return 20;
  const n = parseInt(t, 10);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  if (t === 'light') return 100;
  return 20;
}

function derivePalette(accentHex: string, brightness: number) {
  const [h, s] = hexToHsl(accentHex);
  const bL = Math.max(4, Math.min(98, brightness));
  const isLight = bL > 50;
  const tL = isLight ? Math.max(14, 94 - bL) : Math.min(94, bL + 75);
  const mL = isLight ? Math.max(38, bL - 30) : Math.min(72, bL + 38);
  return {
    bg: hslToHex(h, 8, bL),
    text: hslToHex(h, 3, tL),
    muted: hslToHex(h, 8, mL),
    accentTint: hslToHex(h, Math.max(s, 40), 90),
    accentText: hslToHex(h, Math.max(s, 40), isLight ? 48 : 72)
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
  return (parts[0][0] + parts[1][0]).toLowerCase();
}

// Satori requires `display: flex` on ANY div with children (even a text child).
// This helper makes sure every element we build satisfies that rule.
const box = (style: Record<string, any>, children: any) => ({
  type: 'div',
  props: {
    style: { display: 'flex', ...style },
    children
  }
});

// The chain-link brand mark — same shapes as the app's inline SVG, colored
// via the derived palette so it reads on any theme.
function iksiMark(fillColor: string, strokeColor: string, size = 44) {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      children: [
        { type: 'circle', props: { cx: 12, cy: 12, r: 11, fill: fillColor } },
        {
          type: 'g',
          props: {
            transform: 'rotate(-45 12 12)',
            stroke: strokeColor,
            strokeWidth: 1.5,
            fill: 'none',
            children: [
              { type: 'rect', props: { x: 4, y: 10, width: 7, height: 4, rx: 2 } },
              { type: 'rect', props: { x: 13, y: 10, width: 7, height: 4, rx: 2 } }
            ]
          }
        }
      ]
    }
  };
}

export const GET: RequestHandler = async ({ params }) => {
  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('$lib/prisma.js');
  const record = await prisma.handle.findUnique({
    where: { handle },
    include: { user: { include: { profile: true } } }
  });
  if (!record?.user?.profile) return new Response('not found', { status: 404 });

  const p = record.user.profile;
  const displayName = p.displayName ?? `@${handle}`;
  const accent = p.accent ?? '#3B82F6';
  const brightness = brightnessOf(p.theme);
  const palette = derivePalette(accent, brightness);
  const bio = p.bio ? p.bio.trim().slice(0, 240) : '';

  // --- Avatar block ---
  const avatar = p.avatarUrl
    ? {
        type: 'img',
        props: {
          src: normalizeAvatarUrl(p.avatarUrl),
          style: {
            width: 160,
            height: 160,
            borderRadius: 80,
            objectFit: 'cover',
            flexShrink: 0
          }
        }
      }
    : box(
        {
          width: 160,
          height: 160,
          borderRadius: 80,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          background: palette.accentTint,
          color: palette.accentText,
          fontSize: 68,
          fontWeight: 700
        },
        initials(displayName)
      );

  // --- Identity block: name + full iksi.app/@handle URL under it ---
  const nameEl = box(
    { fontSize: 76, fontWeight: 700, color: palette.text, lineHeight: 1.05, marginTop: 40, textAlign: 'center' },
    displayName
  );

  const urlEl = box(
    { fontSize: 34, color: palette.accentText, marginTop: 14 },
    `iksi.app/@${handle}`
  );

  // --- Bio (optional) ---
  const bioBlock = bio
    ? box(
        {
          fontSize: 34,
          fontWeight: 500,
          color: palette.text,
          lineHeight: 1.35,
          marginTop: 40,
          maxWidth: 900,
          textAlign: 'center'
        },
        bio
      )
    : null;

  // --- Footer: chain-link mark + "iksi" wordmark, centered at bottom ---
  const footer = box(
    { alignItems: 'center', gap: 14, marginTop: 'auto' },
    [
      iksiMark(palette.text, palette.bg, 44),
      box(
        { fontSize: 34, fontWeight: 600, color: palette.text, letterSpacing: -0.5 },
        'iksi'
      )
    ]
  );

  // --- Root frame: everything centered vertically and horizontally ---
  const contentChildren: any[] = [avatar, nameEl, urlEl];
  if (bioBlock) contentChildren.push(bioBlock);
  contentChildren.push(footer);

  const root = box(
    {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '72px 80px',
      background: palette.bg,
      fontFamily: 'sans-serif',
      textAlign: 'center'
    },
    contentChildren
  );

  return new ImageResponse(root as any, {
    width: 1200,
    height: 630,
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' }
  });
};
