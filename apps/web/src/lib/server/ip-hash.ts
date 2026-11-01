import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 of an IP, keyed with SECRET_KEY: tells one visitor's requests
 * apart from another's (rate limits, distinct reporters) without storing the
 * IP, and without the hash being reversible by trying every IPv4 address.
 * Every rate-limit key and report that would hold an IP holds this instead.
 */
export function hashIp(ip: string): string {
  const key = process.env.SECRET_KEY;
  if (!key || key.length < 32) throw new Error('SECRET_KEY must be set and at least 32 characters');
  return createHmac('sha256', key).update(ip).digest('hex');
}
