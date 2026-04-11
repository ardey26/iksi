import { describe, it, expect } from 'vitest';
import { isUnfurler, UNFURLER_PATTERNS } from './botDetection.js';

describe('isUnfurler', () => {
  it('detects Slack unfurler', () => {
    expect(isUnfurler('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(true);
  });

  it('detects Twitter unfurler', () => {
    expect(isUnfurler('Twitterbot/1.0')).toBe(true);
  });

  it('detects Facebook unfurler', () => {
    expect(isUnfurler('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true);
  });

  it('detects LinkedIn unfurler', () => {
    expect(isUnfurler('LinkedInBot/1.0 (compatible; Mozilla/5.0)')).toBe(true);
  });

  it('detects Discord unfurler', () => {
    expect(isUnfurler('Mozilla/5.0 (compatible; Discordbot/2.0)')).toBe(true);
  });

  it('detects WhatsApp unfurler', () => {
    expect(isUnfurler('WhatsApp/2.19.258 A')).toBe(true);
  });

  it('detects Telegram unfurler', () => {
    expect(isUnfurler('TelegramBot (like TwitterBot)')).toBe(true);
  });

  it('does not match regular browsers', () => {
    expect(isUnfurler('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
    expect(isUnfurler('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)')).toBe(false);
  });

  it('does not match search engine crawlers', () => {
    expect(isUnfurler('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(false);
    expect(isUnfurler('Bingbot/2.0')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isUnfurler(null)).toBe(false);
    expect(isUnfurler(undefined)).toBe(false);
    expect(isUnfurler('')).toBe(false);
  });
});
