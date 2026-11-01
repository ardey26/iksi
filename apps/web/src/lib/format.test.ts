import { describe, it, expect } from 'vitest';
import { displayUrl, formatCount, hostOf, relativeDate, shortDate } from './format.js';

const NOW = new Date('2026-11-01T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('format', () => {
  it('separates thousands', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(12480)).toBe('12,480');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it.each([
    [10_000, 'Just now'],
    [MIN, '1 minute ago'],
    [5 * MIN, '5 minutes ago'],
    [HOUR, '1 hour ago'],
    [3 * HOUR, '3 hours ago'],
    [DAY + HOUR, 'Yesterday'],
    [2 * DAY, '2 days ago'],
    [6 * DAY, '6 days ago']
  ])('%i ms ago reads "%s"', (ms, text) => {
    expect(relativeDate(ago(ms), NOW)).toBe(text);
  });

  it('switches to a short date from 7 days', () => {
    expect(relativeDate('2026-10-15T12:00:00Z', NOW)).toBe('Oct 15');
    expect(relativeDate('2025-03-03T12:00:00Z', NOW)).toBe('Mar 3, 2025');
    expect(shortDate('2026-01-02T12:00:00Z', NOW)).toBe('Jan 2');
  });

  it('shows a URL without its scheme, www, query or trailing slash', () => {
    expect(displayUrl('https://www.example.com/')).toBe('example.com');
    expect(displayUrl('https://docs.google.com/document/d/1x/?usp=sharing#h')).toBe('docs.google.com/document/d/1x');
    expect(displayUrl('mailto:a@b.co')).toBe('mailto:a@b.co');
    expect(displayUrl('')).toBe('');
    expect(hostOf('https://www.github.com/x')).toBe('github.com');
    expect(hostOf('nope')).toBe('');
  });
});
