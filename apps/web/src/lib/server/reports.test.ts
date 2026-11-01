import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// An in-memory LinkReport and LongURL table: enough of Prisma's filters
// (status, reason in, createdAt gte, distinct) to exercise the real threshold.
type Report = { id: number; linkId: number; reason: string; details: string | null; email: string | null; ipHash: string; status: string; createdAt: Date };
type Link = { id: number; shortURL: string; originalURL: string; rules: unknown; settingsVersion: number; oneTime: boolean; userId: number | null; moderation: string | null; moderatedAt: Date | null; safeVerdict: string | null };

const db = vi.hoisted(() => ({ reports: [] as any[], links: [] as any[] }));

const matchReport = (r: Report, where: any) =>
  (where.linkId === undefined || r.linkId === where.linkId) &&
  (where.status === undefined || r.status === where.status) &&
  (where.reason?.in === undefined || where.reason.in.includes(r.reason)) &&
  (where.createdAt?.gte === undefined || r.createdAt >= where.createdAt.gte);

const matchLink = (l: Link, where: any) =>
  (where.id === undefined || l.id === where.id) &&
  (where.shortURL === undefined || l.shortURL === where.shortURL) &&
  (!('moderation' in where) || l.moderation === where.moderation);

const prisma = vi.hoisted(() => ({
  longURL: {
    findUnique: vi.fn(async ({ where }: any) => db.links.find((l) => matchLink(l, where)) ?? null),
    update: vi.fn(async ({ where, data }: any) => Object.assign(db.links.find((l) => l.id === where.id), data)),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const hit = db.links.filter((l) => matchLink(l, where));
      hit.forEach((l) => Object.assign(l, data));
      return { count: hit.length };
    })
  },
  linkReport: {
    create: vi.fn(async ({ data }: any) => {
      const row = { id: db.reports.length + 1, status: 'open', createdAt: new Date(), ...data };
      db.reports.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where, distinct, take, orderBy, select }: any) => {
      let rows = db.reports.filter((r) => matchReport(r, where));
      if (orderBy?.createdAt === 'desc') rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
      if (distinct?.includes('ipHash')) rows = rows.filter((r, i) => rows.findIndex((x) => x.ipHash === r.ipHash) === i);
      if (take) rows = rows.slice(0, take);
      if (select?.link) return rows.map((r) => ({ ...r, link: db.links.find((l) => l.id === r.linkId) }));
      return rows;
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      const hit = db.reports.filter((r) => matchReport(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    })
  },
  profileRow: { updateMany: vi.fn(async () => ({ count: 1 })) }
}));

const rateLimit = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn(async () => true));
const purgeProfile = vi.hoisted(() => vi.fn(async () => {}));
const settleVerdictInBackground = vi.hoisted(() => vi.fn());

vi.mock('#lib/prisma.js', () => ({ prisma }));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));
vi.mock('#lib/server/profile-cache.js', () => ({ purgeProfile }));
vi.mock('#lib/server/link-verdict.js', () => ({ settleVerdictInBackground }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (s: string) => s.replace(/^enc:/, '')) }));

import {
  disableLink,
  dismissReports,
  hashIp,
  holdIfReported,
  openReportGroups,
  REVIEW_THRESHOLD,
  submitReport
} from './reports';
import { REPORT_THANKS } from '#lib/report.js';

const SECRET = 'k'.repeat(40);
const NOW = Date.parse('2026-11-01T12:00:00Z');

const LINK: Link = {
  id: 7,
  shortURL: 'bad',
  originalURL: 'enc:https://evil.example/login',
  rules: [{ id: 'aaaaaaa1', when: { countries: ['SG'] }, destination: 'https://sg.evil.example/' }],
  settingsVersion: 4,
  oneTime: false,
  userId: 3,
  moderation: null,
  moderatedAt: null,
  safeVerdict: 'safe'
};

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ link: 'iksi.app/bad', reason: 'phishing', details: '', email: '', website: '', ...values })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SECRET_KEY = SECRET;
  db.reports = [];
  db.links = [{ ...LINK }];
  rateLimit.mockResolvedValue({ allowed: true, remaining: 1 });
});

describe('hashIp', () => {
  it('is HMAC-SHA256 of the IP keyed with SECRET_KEY, never the IP', () => {
    const h = hashIp('203.0.113.9');
    expect(h).toBe(createHmac('sha256', SECRET).update('203.0.113.9').digest('hex'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203.0.113.9');
  });

  it('changes with the key, so the hash cannot be matched without it', () => {
    const a = hashIp('203.0.113.9');
    process.env.SECRET_KEY = 'z'.repeat(40);
    expect(hashIp('203.0.113.9')).not.toBe(a);
  });

  it('refuses to hash without a 32+ character key', () => {
    process.env.SECRET_KEY = 'short';
    expect(() => hashIp('1.2.3.4')).toThrow(/SECRET_KEY/);
  });
});

describe('submitReport', () => {
  it('stores a report with the IP hash, never the raw IP', async () => {
    const out = await submitReport(form({ details: '  Asks for my bank login  ', email: ' Ana@Example.com ' }), '203.0.113.9', { now: NOW });
    expect(out).toEqual({ ok: true });
    expect(db.reports).toHaveLength(1);
    expect(db.reports[0]).toMatchObject({
      linkId: 7,
      reason: 'phishing',
      details: 'Asks for my bank login',
      email: 'ana@example.com',
      ipHash: hashIp('203.0.113.9'),
      status: 'open'
    });
    expect(JSON.stringify(prisma.linkReport.create.mock.calls)).not.toContain('203.0.113.9');
  });

  it('stores empty optional fields as null', async () => {
    await submitReport(form({ reason: 'spam' }), '1.1.1.1', { now: NOW });
    expect(db.reports[0]).toMatchObject({ details: null, email: null, reason: 'spam' });
  });

  it.each(['bad', 'bad+', 'iksi.app/bad', 'https://www.iksi.app/bad?x=1'])('finds the link from %s', async (link) => {
    await submitReport(form({ link }), '1.1.1.1', { now: NOW });
    expect(prisma.longURL.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { shortURL: 'bad' } }));
  });

  describe('same answer for a link that does not exist', () => {
    it('answers exactly as for a stored report, and stores nothing', async () => {
      const known = await submitReport(form({}), '1.1.1.1', { now: NOW });
      const unknown = await submitReport(form({ link: 'iksi.app/nope' }), '1.1.1.2', { now: NOW });
      expect(unknown).toEqual(known);
      expect(unknown).toEqual({ ok: true });
      expect(db.reports).toHaveLength(1);
    });

    it('still counts against the reporter, so the hourly limit cannot probe for links', async () => {
      await submitReport(form({ link: 'iksi.app/nope' }), '1.1.1.1', { now: NOW });
      expect(rateLimit).toHaveBeenCalledWith(`report:ip:${hashIp('1.1.1.1')}`, 5, 3_600_000);
    });
  });

  describe('honeypot', () => {
    it('thanks a bot that filled the hidden field, and stores and counts nothing', async () => {
      const out = await submitReport(form({ website: 'https://spam.example' }), '1.1.1.1', { now: NOW });
      expect(out).toEqual({ ok: true });
      expect(db.reports).toHaveLength(0);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(prisma.longURL.findUnique).not.toHaveBeenCalled();
    });

    it('thanks a bot even when the rest of the form is junk', async () => {
      expect(await submitReport(form({ website: 'x', link: '', reason: '' }), '1.1.1.1')).toEqual({ ok: true });
    });
  });

  describe('rate limits', () => {
    it('allows 5 reports per hour per IP hash', async () => {
      await submitReport(form({}), '9.9.9.9', { now: NOW });
      expect(rateLimit).toHaveBeenNthCalledWith(1, `report:ip:${hashIp('9.9.9.9')}`, 5, 60 * 60 * 1000);
      // The raw IP never goes into a limiter key either.
      expect(rateLimit.mock.calls.flat().join(' ')).not.toContain('9.9.9.9');
    });

    it('turns away a reporter over the hourly limit with a reason, before the link is read', async () => {
      rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
      const out = await submitReport(form({}), '9.9.9.9', { now: NOW });
      expect(out).toMatchObject({ ok: false, status: 429 });
      expect((out as any).errors.form).toMatch(/Try again later/);
      expect(prisma.longURL.findUnique).not.toHaveBeenCalled();
      expect(db.reports).toHaveLength(0);
    });

    it('allows 20 reports per day per link', async () => {
      await submitReport(form({}), '9.9.9.9', { now: NOW });
      expect(rateLimit).toHaveBeenNthCalledWith(2, 'report:link:7', 20, 24 * 60 * 60 * 1000);
    });

    it('thanks and drops a report over the link limit, so the answer stays the same', async () => {
      rateLimit.mockResolvedValueOnce({ allowed: true }).mockResolvedValueOnce({ allowed: false });
      expect(await submitReport(form({}), '9.9.9.9', { now: NOW })).toEqual({ ok: true });
      expect(db.reports).toHaveLength(0);
    });

    it('works through the real limiter: the 6th report in an hour is refused', async () => {
      const counts = new Map<string, number>();
      rateLimit.mockImplementation(async (id: string, max: number) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        return { allowed: (counts.get(id) as number) <= max };
      });
      const results = [];
      for (let i = 0; i < 6; i++) results.push(await submitReport(form({ reason: 'spam' }), '5.5.5.5', { now: NOW }));
      expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
      expect(results[5]).toMatchObject({ ok: false, status: 429 });
      expect(db.reports).toHaveLength(5);
    });

    it('caps a link at 20 stored reports a day from many reporters', async () => {
      const counts = new Map<string, number>();
      rateLimit.mockImplementation(async (id: string, max: number) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
        return { allowed: (counts.get(id) as number) <= max };
      });
      for (let i = 0; i < 25; i++) await submitReport(form({ reason: 'spam' }), `10.0.0.${i}`, { now: NOW });
      expect(db.reports).toHaveLength(20);
    });
  });

  describe('validation', () => {
    it.each([
      [{ link: '' }, 'link', 'Enter the short link.'],
      [{ link: 'https://google.com/abc' }, 'link', 'Enter an iksi.app short link, like iksi.app/abc.'],
      [{ reason: '' }, 'reason', 'Choose a reason.'],
      [{ reason: 'hate' }, 'reason', 'Choose a reason.'],
      [{ details: 'x'.repeat(1001) }, 'details', 'Keep the details to 1,000 characters.'],
      [{ email: 'not-an-email' }, 'email', 'Enter a valid email, or leave it empty.']
    ])('%j fails on %s', async (values, key, message) => {
      const out = await submitReport(form(values), '1.1.1.1');
      expect(out).toMatchObject({ ok: false, status: 400 });
      expect((out as any).errors[key]).toBe(message);
      expect(rateLimit).not.toHaveBeenCalled();
      expect(db.reports).toHaveLength(0);
    });

    it('accepts exactly 1,000 characters of details', async () => {
      expect(await submitReport(form({ details: 'x'.repeat(1000) }), '1.1.1.1')).toEqual({ ok: true });
    });

    it('gives back what was typed so the form keeps it', async () => {
      const out = await submitReport(form({ link: 'nope.com', details: 'hi' }), '1.1.1.1');
      expect((out as any).values).toMatchObject({ link: 'nope.com', details: 'hi', reason: 'phishing' });
    });
  });

  it('thanks copy is the agreed sentence', () => expect(REPORT_THANKS).toBe("Thanks. We'll review it."));
});

describe('auto review', () => {
  const report = (ip: string, reason = 'phishing', now = NOW) => submitReport(form({ reason }), ip, { now });

  it('holds a link after 3 phishing or malware reports from different IPs', async () => {
    await report('1.0.0.1');
    await report('1.0.0.2', 'malware');
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.3');
    expect(REVIEW_THRESHOLD).toBe(3);
    expect(db.links[0]).toMatchObject({ moderation: 'review', moderatedAt: new Date(NOW) });
  });

  it('runs a fresh Safe Browsing check over every destination through the settle path', async () => {
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await report(ip);
    expect(settleVerdictInBackground).toHaveBeenCalledTimes(1);
    expect(settleVerdictInBackground).toHaveBeenCalledWith(
      'bad',
      ['https://evil.example/login', 'https://sg.evil.example/'],
      4
    );
  });

  it('purges the edge record and the owner profile, and hides the link from profiles', async () => {
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await report(ip);
    expect(purgeEdge).toHaveBeenCalledWith(['bad']);
    expect(purgeProfile).toHaveBeenCalledWith(3);
    expect(prisma.profileRow.updateMany).toHaveBeenCalledWith({ where: { linkId: 7 }, data: { quarantined: true } });
  });

  it('does not count the same IP twice', async () => {
    for (let i = 0; i < 5; i++) await report('1.0.0.1');
    await report('1.0.0.2');
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.3');
    expect(db.links[0].moderation).toBe('review');
  });

  it('does not count spam, illegal content or other', async () => {
    await report('1.0.0.1', 'spam');
    await report('1.0.0.2', 'illegal');
    await report('1.0.0.3', 'other');
    await report('1.0.0.4');
    await report('1.0.0.5');
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.6', 'malware');
    expect(db.links[0].moderation).toBe('review');
  });

  it('only counts reports from the last 24 hours', async () => {
    const day = 24 * 60 * 60 * 1000;
    await report('1.0.0.1', 'phishing', NOW - day - 1);
    await report('1.0.0.2', 'phishing', NOW - 1000);
    await report('1.0.0.3', 'phishing', NOW);
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.4', 'phishing', NOW);
    expect(db.links[0].moderation).toBe('review');
  });

  it('does not count reports an admin already dismissed', async () => {
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await report(ip);
    await dismissReports(7, NOW);
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.4');
    await report('1.0.0.5');
    expect(db.links[0].moderation).toBeNull();
    await report('1.0.0.6');
    expect(db.links[0].moderation).toBe('review');
  });

  it('holds once: later reports change nothing and do not re-check', async () => {
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3', '1.0.0.4']) await report(ip);
    expect(settleVerdictInBackground).toHaveBeenCalledTimes(1);
    expect(purgeEdge).toHaveBeenCalledTimes(1);
  });

  it('never turns a disabled link back into a review', async () => {
    db.links[0].moderation = 'disabled';
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await report(ip);
    expect(db.links[0].moderation).toBe('disabled');
  });

  it('holds a one-time link without reading its content for a check', async () => {
    db.links[0] = { ...LINK, oneTime: true, originalURL: '' };
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await report(ip);
    expect(db.links[0].moderation).toBe('review');
    expect(settleVerdictInBackground).not.toHaveBeenCalled();
  });

  it('holdIfReported is false below the threshold', async () => {
    await report('1.0.0.1');
    expect(await holdIfReported(7, NOW)).toBe(false);
  });
});

describe('admin actions', () => {
  beforeEach(async () => {
    for (const ip of ['1.0.0.1', '1.0.0.2', '1.0.0.3']) await submitReport(form({}), ip, { now: NOW });
    await submitReport(form({ reason: 'spam', details: 'Newest note' }), '1.0.0.9', { now: NOW + 1000 });
    vi.clearAllMocks();
  });

  it('Disable link disables it for good, marks the reports actioned and purges caches', async () => {
    expect(await disableLink(7, NOW)).toBe(true);
    expect(db.links[0].moderation).toBe('disabled');
    expect(db.reports.every((r) => r.status === 'actioned')).toBe(true);
    expect(prisma.profileRow.updateMany).toHaveBeenCalledWith({ where: { linkId: 7 }, data: { quarantined: true } });
    expect(purgeEdge).toHaveBeenCalledWith(['bad']);
    expect(purgeProfile).toHaveBeenCalledWith(3);
  });

  it('Dismiss lifts the review, marks the reports dismissed and shows the link on profiles again', async () => {
    expect(await dismissReports(7, NOW)).toBe(true);
    expect(db.links[0].moderation).toBeNull();
    expect(db.reports.every((r) => r.status === 'dismissed')).toBe(true);
    expect(prisma.profileRow.updateMany).toHaveBeenCalledWith({ where: { linkId: 7 }, data: { quarantined: false } });
    expect(purgeEdge).toHaveBeenCalledWith(['bad']);
    expect(purgeProfile).toHaveBeenCalledWith(3);
  });

  it('Dismiss keeps a Safe Browsing flag in force: the link stays off profiles', async () => {
    db.links[0].safeVerdict = 'phishing';
    await dismissReports(7, NOW);
    expect(db.links[0].moderation).toBeNull();
    expect(prisma.profileRow.updateMany).not.toHaveBeenCalled();
  });

  it('Dismiss never re-enables a disabled link', async () => {
    db.links[0].moderation = 'disabled';
    await dismissReports(7, NOW);
    expect(db.links[0].moderation).toBe('disabled');
    expect(purgeEdge).not.toHaveBeenCalled();
  });

  it('both are false for a link that is gone', async () => {
    expect(await disableLink(99)).toBe(false);
    expect(await dismissReports(99)).toBe(false);
  });

  it('lists open reports grouped by link with counts by reason and the latest details', async () => {
    const groups = await openReportGroups();
    expect(groups).toEqual([
      {
        linkId: 7,
        shortURL: 'bad',
        host: 'evil.example',
        destination: 'https://evil.example/login',
        moderation: 'review',
        safeVerdict: 'safe',
        total: 4,
        reasons: [
          { reason: 'phishing', count: 3 },
          { reason: 'spam', count: 1 }
        ],
        latestAt: expect.any(Date),
        latestDetails: 'Newest note'
      }
    ]);
  });

  it('drops a link from the list once acted on', async () => {
    await disableLink(7);
    expect(await openReportGroups()).toEqual([]);
  });
});
