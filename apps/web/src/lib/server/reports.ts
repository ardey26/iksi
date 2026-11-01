/**
 * Link reports: visitors flag a short link (phishing, malware...) from
 * /report, and an admin reviews them on the admin host.
 *
 * Abuse hygiene, so iksi.app is not itself flagged for what people shorten:
 * when 3 different visitors report the same link for phishing or malware
 * within a day, the link is held for review at once. A held link shows a
 * warning page instead of redirecting (here and at the edge) until an admin
 * disables it or dismisses the reports, and it gets a fresh Safe Browsing
 * check over every destination it can send a visitor to.
 *
 * The reporter is never told whether the link exists: a report for a link
 * that does not exist gets the same answer as one that was stored.
 */
import { prisma } from '#lib/prisma.js';
import { rateLimit } from '#lib/rateLimit.js';
import { decodeURL } from '#lib/server/crypto.js';
import { purgeEdge } from '#lib/server/edge-purge.js';
import { hashIp } from '#lib/server/ip-hash.js';
import { destinationsOf, isFlagged } from '#lib/server/link-record.js';
import { settleVerdictInBackground } from '#lib/server/link-verdict.js';
import { purgeProfile } from '#lib/server/profile-cache.js';
import {
  DETAILS_MAX,
  EMAIL_MAX,
  HONEYPOT,
  isReportReason,
  parseReportLink,
  URGENT_REASONS,
  type ReportReason
} from '#lib/report.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const REPORTS_PER_IP_PER_HOUR = 5;
export const REPORTS_PER_LINK_PER_DAY = 20;
/** Distinct reporters (by IP hash) of phishing or malware within REVIEW_WINDOW_MS. */
export const REVIEW_THRESHOLD = 3;
export const REVIEW_WINDOW_MS = DAY;

export type Moderation = 'review' | 'disabled';
export type ReportStatus = 'open' | 'actioned' | 'dismissed';

export { hashIp };

export interface ReportValues {
  link: string;
  reason: string;
  details: string;
  email: string;
}

export type ReportErrors = Partial<Record<'link' | 'reason' | 'details' | 'email' | 'form', string>>;

export type ReportOutcome =
  | { ok: true }
  | { ok: false; status: 400 | 429; errors: ReportErrors; values: ReportValues };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const field = (form: FormData, name: string): string => {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
};

function validate(values: ReportValues, dev: boolean) {
  const errors: ReportErrors = {};
  const slug = parseReportLink(values.link, dev);
  if (values.link.trim() === '') errors.link = 'Enter the short link.';
  else if (slug === null) errors.link = 'Enter an iksi.app short link, like iksi.app/abc.';
  if (!isReportReason(values.reason)) errors.reason = 'Choose a reason.';
  const details = values.details.trim();
  if (details.length > DETAILS_MAX) errors.details = 'Keep the details to 1,000 characters.';
  const email = values.email.trim().toLowerCase();
  if (email !== '' && (email.length > EMAIL_MAX || !EMAIL.test(email))) {
    errors.email = 'Enter a valid email, or leave it empty.';
  }
  return { errors, slug, reason: values.reason as ReportReason, details, email };
}

/**
 * Handles one report form submission from `ip`. Only a malformed form or a
 * reporter over their hourly limit gets anything but `{ ok: true }`.
 */
export async function submitReport(
  form: FormData,
  ip: string,
  { now = Date.now(), dev = false }: { now?: number; dev?: boolean } = {}
): Promise<ReportOutcome> {
  // A bot filled the field people never see: thank it and keep nothing.
  if (field(form, HONEYPOT) !== '') return { ok: true };

  const values: ReportValues = {
    link: field(form, 'link'),
    reason: field(form, 'reason'),
    details: field(form, 'details'),
    email: field(form, 'email')
  };
  const checked = validate(values, dev);
  if (Object.keys(checked.errors).length > 0 || checked.slug === null) {
    return { ok: false, status: 400, errors: checked.errors, values };
  }

  const ipHash = hashIp(ip);
  // Counted before the link is looked up, so the limit is the same for links
  // that exist and links that do not.
  const perIp = await rateLimit(`report:ip:${ipHash}`, REPORTS_PER_IP_PER_HOUR, HOUR);
  if (!perIp.allowed) {
    return {
      ok: false,
      status: 429,
      errors: { form: 'You have sent several reports in the last hour. Try again later.' },
      values
    };
  }

  const link = await prisma.longURL.findUnique({
    where: { shortURL: checked.slug },
    select: { id: true }
  });
  if (!link) return { ok: true };

  // A link this widely reported already has the attention it needs; extra
  // reports are thanked and dropped.
  const perLink = await rateLimit(`report:link:${link.id}`, REPORTS_PER_LINK_PER_DAY, DAY);
  if (!perLink.allowed) return { ok: true };

  await prisma.linkReport.create({
    data: {
      linkId: link.id,
      reason: checked.reason,
      details: checked.details || null,
      email: checked.email || null,
      ipHash,
      createdAt: new Date(now)
    }
  });

  if (URGENT_REASONS.includes(checked.reason)) await holdIfReported(link.id, now);
  return { ok: true };
}

/**
 * Holds a link for review once REVIEW_THRESHOLD different visitors have
 * reported it for phishing or malware within the window. True when this call
 * put it on hold; a link already held or disabled is left as it is.
 */
export async function holdIfReported(linkId: number, now = Date.now()): Promise<boolean> {
  const reporters = await prisma.linkReport.findMany({
    where: {
      linkId,
      status: 'open',
      reason: { in: [...URGENT_REASONS] },
      createdAt: { gte: new Date(now - REVIEW_WINDOW_MS) }
    },
    select: { ipHash: true },
    distinct: ['ipHash'],
    take: REVIEW_THRESHOLD
  });
  if (new Set(reporters.map((r) => r.ipHash)).size < REVIEW_THRESHOLD) return false;

  // Conditional, so of two reports landing together only one holds the link.
  const { count } = await prisma.longURL.updateMany({
    where: { id: linkId, moderation: null },
    data: { moderation: 'review', moderatedAt: new Date(now) }
  });
  if (count === 0) return false;

  const link = await prisma.longURL.findUnique({
    where: { id: linkId },
    select: { shortURL: true, originalURL: true, rules: true, settingsVersion: true, oneTime: true, userId: true }
  });
  if (!link) return false;

  await quarantine(linkId, true);
  await purgeEdge([link.shortURL]);
  if (link.userId !== null) await purgeProfile(link.userId);
  // A one-time link's content is encrypted in `secret` and was checked when it was made.
  if (!link.oneTime) {
    const destination = await decodeURL(link.originalURL);
    settleVerdictInBackground(link.shortURL, destinationsOf(destination, link.rules), link.settingsVersion);
  }
  return true;
}

/** Hides (or shows again) the link's rows on profile pages. */
async function quarantine(linkId: number, on: boolean) {
  await prisma.profileRow.updateMany({ where: { linkId }, data: { quarantined: on } });
}

/**
 * Admin: disable a reported link for good. It shows the disabled page
 * everywhere, comes off profile pages, and its open reports are marked
 * actioned. Safe Browsing re-checks and settings edits never undo it.
 */
export async function disableLink(linkId: number, now = Date.now()): Promise<boolean> {
  const link = await prisma.longURL.findUnique({ where: { id: linkId }, select: { shortURL: true, userId: true } });
  if (!link) return false;
  await prisma.longURL.update({ where: { id: linkId }, data: { moderation: 'disabled', moderatedAt: new Date(now) } });
  await prisma.linkReport.updateMany({ where: { linkId, status: 'open' }, data: { status: 'actioned' } });
  await quarantine(linkId, true);
  await purgeEdge([link.shortURL]);
  if (link.userId !== null) await purgeProfile(link.userId);
  return true;
}

/**
 * Admin: the reports were not borne out. Marks the open reports dismissed and
 * lifts a review hold, so the link redirects again (unless Safe Browsing
 * flagged it meanwhile). A disabled link stays disabled.
 */
export async function dismissReports(linkId: number, now = Date.now()): Promise<boolean> {
  const link = await prisma.longURL.findUnique({
    where: { id: linkId },
    select: { shortURL: true, userId: true, moderation: true, safeVerdict: true }
  });
  if (!link) return false;
  await prisma.linkReport.updateMany({ where: { linkId, status: 'open' }, data: { status: 'dismissed' } });
  if (link.moderation !== 'review') return true;

  const { count } = await prisma.longURL.updateMany({
    where: { id: linkId, moderation: 'review' },
    data: { moderation: null, moderatedAt: new Date(now) }
  });
  if (count === 0) return true;
  if (!isFlagged(link.safeVerdict)) await quarantine(linkId, false);
  await purgeEdge([link.shortURL]);
  if (link.userId !== null) await purgeProfile(link.userId);
  return true;
}

export interface ReportGroup {
  linkId: number;
  shortURL: string;
  /** Destination host; null for a one-time link, whose content is never read here. */
  host: string | null;
  destination: string | null;
  moderation: Moderation | null;
  safeVerdict: string | null;
  total: number;
  /** Most reported first. */
  reasons: { reason: ReportReason; count: number }[];
  latestAt: Date;
  latestDetails: string | null;
}

const OPEN_LIST_MAX = 500;

/** Admin: open reports grouped by link, the most recently reported link first. */
export async function openReportGroups(): Promise<ReportGroup[]> {
  const reports = await prisma.linkReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: OPEN_LIST_MAX,
    select: {
      linkId: true,
      reason: true,
      details: true,
      createdAt: true,
      link: {
        select: { shortURL: true, originalURL: true, oneTime: true, moderation: true, safeVerdict: true }
      }
    }
  });

  const groups = new Map<number, ReportGroup & { counts: Map<ReportReason, number> }>();
  for (const r of reports) {
    let g = groups.get(r.linkId);
    if (!g) {
      const destination = r.link.oneTime ? null : await decodeURL(r.link.originalURL);
      let host: string | null = null;
      try {
        host = destination ? new URL(destination).host : null;
      } catch {
        host = null;
      }
      g = {
        linkId: r.linkId,
        shortURL: r.link.shortURL,
        host,
        destination,
        moderation: r.link.moderation === 'review' || r.link.moderation === 'disabled' ? r.link.moderation : null,
        safeVerdict: r.link.safeVerdict,
        total: 0,
        reasons: [],
        latestAt: r.createdAt,
        latestDetails: null,
        counts: new Map()
      };
      groups.set(r.linkId, g);
    }
    g.total++;
    const reason = isReportReason(r.reason) ? r.reason : 'other';
    g.counts.set(reason, (g.counts.get(reason) ?? 0) + 1);
    // Newest first, so the first details seen are the latest.
    if (g.latestDetails === null && r.details) g.latestDetails = r.details;
  }

  return [...groups.values()].map(({ counts, ...g }) => ({
    ...g,
    reasons: [...counts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
  }));
}
