/**
 * A flagged link must stay flagged through any settings edit until a completed
 * Safe Browsing check over every destination clears it. Runs the real PATCH,
 * verdict settlement, Safe Browsing client and slug route against one row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ row: {} as Row, pending: [] as Promise<unknown>[] }));

/** Enough of Prisma's where semantics for these calls; NOT IN never matches NULL, as in SQL. */
function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Record<string, any>[]).some((w) => matches(row, w));
    if (cond !== null && typeof cond === 'object' && 'notIn' in cond) {
      return row[key] !== null && !cond.notIn.includes(row[key]);
    }
    return row[key] === cond;
  });
}

vi.mock('#lib/prisma.js', () => ({
  prisma: {
    longURL: {
      findUnique: vi.fn(async ({ where }: any) => (matches(db.row, where) ? { ...db.row } : null)),
      update: vi.fn(async ({ where, data }: any) => {
        if (!matches(db.row, where)) throw new Error('not found');
        Object.assign(db.row, data);
        return { ...db.row };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!matches(db.row, where)) return { count: 0 };
        Object.assign(db.row, data);
        return { count: 1 };
      })
    },
    profileRow: { updateMany: vi.fn(async () => ({ count: 0 })) }
  }
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p: Promise<unknown>) => db.pending.push(p) }));
vi.mock('#lib/server/user-auth.js', () => ({ verifyUserSession: () => 7 }));
vi.mock('#lib/server/crypto.js', () => ({
  encodeURL: (u: string) => `enc:${u}`,
  decodeURL: async (u: string) => u.replace(/^enc:/, '')
}));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge: vi.fn(async () => true) }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit: async () => ({ allowed: true }) }));
vi.mock('#lib/server/tracking.js', () => ({ recordClick: async () => {} }));

import { PATCH } from '../../routes/(app)/dashboard/links/+server';
import { load } from '../../routes/[slug]/+page.server';

const BAD = 'https://bad.example/';
const rule = (id: string, destination: string) => ({ id, when: { countries: ['SG'] }, destination });

function patch(body: object) {
  const request = new Request('https://www.iksi.app/dashboard/links', {
    method: 'PATCH',
    body: JSON.stringify({ id: 5, ...body })
  });
  return PATCH({ request, cookies: { get: () => 'tok' } } as never);
}

async function visit(): Promise<{ status: number; location?: string }> {
  const url = new URL('https://www.iksi.app/AbC');
  const event = {
    url,
    params: { slug: 'AbC' },
    request: new Request(url),
    setHeaders: () => {},
    getClientAddress: () => '1.2.3.4'
  };
  try {
    await load(event as never);
    return { status: 200 };
  } catch (e: any) {
    return { status: e.status, location: e.location };
  }
}

async function settle() {
  await Promise.all(db.pending.splice(0));
}

const safeBrowsingDown = () => {
  global.fetch = vi.fn(async () => new Response('down', { status: 503 })) as never;
};
const safeBrowsingClean = () => {
  global.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as never;
};
const sentURLs = () =>
  JSON.parse((global.fetch as any).mock.calls[0][1].body).threatInfo.threatEntries.map((e: any) => e.url);

const originalFetch = global.fetch;
beforeEach(() => {
  db.pending.length = 0;
  process.env.SAFE_BROWSING_API_KEY = 'k';
  db.row = {
    id: 5,
    userId: 7,
    shortURL: 'AbC',
    originalURL: 'enc:https://e.com/',
    safeVerdict: 'safe',
    safeCheckedAt: null,
    rules: null,
    expiresAt: null,
    maxClicks: null,
    expiredAt: null,
    passwordHash: null,
    permanent: false,
    clickCount: 0
  };
});
afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.SAFE_BROWSING_API_KEY;
});

describe('a flagged link keeps its flag through edits', () => {
  it('a rules edit stays 403 immediately and after settling with Safe Browsing down', async () => {
    Object.assign(db.row, { originalURL: `enc:${BAD}`, safeVerdict: 'malware' });
    safeBrowsingDown();
    expect((await patch({ rules: [rule('rule-aaa', 'https://ok.example/')] })).status).toBe(200);
    expect(db.row.safeVerdict).toBe('malware');
    expect((await visit()).status).toBe(403);
    await settle();
    expect(db.row.safeVerdict).toBe('malware');
    expect((await visit()).status).toBe(403);
  });

  it('stays flagged when Safe Browsing is not configured', async () => {
    Object.assign(db.row, { originalURL: `enc:${BAD}`, safeVerdict: 'phishing' });
    delete process.env.SAFE_BROWSING_API_KEY;
    await patch({ rules: [rule('rule-aaa', 'https://ok.example/')] });
    await settle();
    expect(db.row.safeVerdict).toBe('phishing');
    expect((await visit()).status).toBe(403);
  });

  it('a destination change stays flagged until a check completes', async () => {
    Object.assign(db.row, { originalURL: `enc:${BAD}`, safeVerdict: 'malware' });
    safeBrowsingDown();
    await patch({ destination: 'https://new.example/' });
    expect((await visit()).status).toBe(403);
    await settle();
    expect((await visit()).status).toBe(403);
  });

  it('removing the bad rule destination clears the flag once a clean check over every destination completes', async () => {
    Object.assign(db.row, { rules: [rule('rule-bad', BAD)], safeVerdict: 'malware' });
    safeBrowsingClean();
    await patch({ rules: [rule('rule-ok1', 'https://ok.example/')] });
    expect((await visit()).status).toBe(403);
    await settle();
    expect(sentURLs()).toEqual(['https://e.com/', 'https://ok.example/']);
    expect(db.row.safeVerdict).toBe('safe');
    expect(await visit()).toEqual({ status: 302, location: 'https://e.com/' });
  });

  it('an unflagged link still goes pending on a rules edit', async () => {
    safeBrowsingDown();
    await patch({ rules: [rule('rule-aaa', 'https://ok.example/')] });
    expect(db.row.safeVerdict).toBe('pending');
  });
});
