// Display formatting for app screens (DESIGN.md › App UI system › Format all data).
// Only for display: stored values are never rewritten.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "12,480": thousands separators, whole numbers. */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** "Oct 15", or "Mar 3, 2025" outside the current year. */
export function shortDate(value: string | Date, now: number = Date.now()): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/**
 * "Just now", "5 minutes ago", "3 hours ago", "Yesterday", "2 days ago" under
 * 7 days; a short date after that ("Oct 15").
 */
export function relativeDate(value: string | Date, now: number = Date.now()): string {
  const d = new Date(value);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  if (diff < 0 || diff >= 7 * DAY) return shortDate(d, now);
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(diff / DAY);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/**
 * "docs.google.com/document/d/1x": a URL without its scheme, "www.", query,
 * hash or trailing slash. The full URL belongs in a title attribute.
 */
export function displayUrl(value: string): string {
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return value;
    const host = u.hostname.replace(/^www\./, '');
    const path = decodeURI(u.pathname).replace(/\/+$/, '');
    return host + path;
  } catch {
    return value;
  }
}

/** "example.com": the host alone, without "www.". */
export function hostOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

