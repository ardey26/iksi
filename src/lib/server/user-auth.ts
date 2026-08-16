import { createHmac, timingSafeEqual } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SECRET_KEY;
  if (!s || s.length < 32) throw new Error('SECRET_KEY must be set and at least 32 chars');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function createUserSession(userId: number, ttlSec: number = DEFAULT_TTL_SEC): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyUserSession(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [uidStr, expStr, sig] = parts;
  const uid = Number(uidStr);
  const exp = Number(expStr);
  if (!Number.isInteger(uid) || !Number.isInteger(exp)) return null;
  if (exp * 1000 < Date.now()) return null;

  const expected = sign(`${uidStr}.${expStr}`);
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  } catch {
    return null;
  }
  return uid;
}
