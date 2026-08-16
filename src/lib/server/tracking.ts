import type { RequestEvent } from '@sveltejs/kit';

export type UAInfo = { browser: string; device: string };

const BOT_RE = /bot|crawl|spider|slurp|fetch|monitor/i;

export function parseUA(ua: string | null | undefined): UAInfo {
  if (!ua) return { browser: 'Other', device: 'desktop' };

  const device: string = BOT_RE.test(ua)
    ? 'bot'
    : /iPad|Tablet/i.test(ua)
      ? 'tablet'
      : /Mobi|Android/i.test(ua)
        ? 'mobile'
        : 'desktop';

  let browser = 'Other';
  if (device !== 'bot') {
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Chrome\//.test(ua)) browser = 'Chrome';
    else if (/Safari\//.test(ua)) browser = 'Safari';
  }

  return { browser, device };
}

export function normalizeReferrer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./i, '') || null;
  } catch {
    return null;
  }
}

export async function recordClick(urlId: number, event: RequestEvent): Promise<void> {
  try {
    // Dynamic import: vi.mock hoisting is not reliable through SvelteKit's $lib alias,
    // and dynamic import lets the test-time mock replace the module registry entry.
    const { prisma } = await import('$lib/prisma.js');
    const h = event.request.headers;
    const { browser, device } = parseUA(h.get('user-agent'));
    const referrer = normalizeReferrer(h.get('referer'));
    const country = h.get('x-vercel-ip-country') || null;

    await prisma.$transaction([
      prisma.click.create({
        data: { urlId, referrer, country, browser, device }
      }),
      prisma.longURL.update({
        where: { id: urlId },
        data: { clickCount: { increment: 1 } }
      })
    ]);
  } catch (err) {
    console.error('recordClick failed', err);
  }
}
