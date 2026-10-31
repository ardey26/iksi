import bcrypt from 'bcrypt';
import { parseRules, type Rule } from '@iksi/core';
import type { Prisma } from '@prisma/client';
import { encodeURL } from '#lib/server/crypto.js';
import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
import { addPrefix, isValidURLServer } from '#lib/utils/urlValidation.js';
import { isFlagged } from '#lib/server/link-record.js';

const MAX_URL = 2048;
const MAX_CLICKS_CAP = 1_000_000_000;
const INVALID_URL = 'Enter a valid URL';
const BCRYPT_COST = 10;

export interface SettingsInput {
  destination?: string;
  rules?: unknown;
  expiresAt?: string | null;
  maxClicks?: number | null;
  password?: string | null;
  permanent?: boolean;
}

export interface LinkSettings {
  destination: string;
  rules: Rule[];
  expiresAt: string | null;
  maxClicks: number | null;
  hasPassword: boolean;
  permanent: boolean;
}

type Result =
  | {
      ok: true;
      data: Prisma.LongURLUpdateInput;
      destinationChanged: string | null;
      /** Rule destinations are served as redirects too, so a change needs a fresh verdict. */
      rulesChanged: boolean;
    }
  | { ok: false; error: string };

const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The edge serves these as redirects without re-checking, so every destination gets the same server rules. */
function destinationError(url: string): string | null {
  if (url.length > MAX_URL) return `URL is too long (max ${MAX_URL} characters)`;
  if (!isValidURLServer(url)) return INVALID_URL;
  return null;
}

export async function validateSettings(
  input: SettingsInput,
  current: {
    clickCount: number;
    destination?: string;
    expiresAt?: Date | null;
    maxClicks?: number | null;
    safeVerdict?: string | null;
  },
  now: number
): Promise<Result> {
  const data: Prisma.LongURLUpdateInput = {};
  // An edit never lowers a flag: only a completed check over every destination may clear it.
  const markPending = () => {
    if (!isFlagged(current.safeVerdict)) data.safeVerdict = 'pending';
  };
  let destinationChanged: string | null = null;
  let rulesChanged = false;

  if (input.destination !== undefined) {
    if (typeof input.destination !== 'string') return bad('Invalid input');
    const destination = addPrefix(input.destination);
    const err = destinationError(destination);
    if (err) return bad(err);
    if (destination !== current.destination) {
      data.originalURL = encodeURL(destination);
      markPending();
      destinationChanged = destination;
    }
  }

  if (input.rules !== undefined) {
    const parsed = parseRules(input.rules);
    if (!parsed.ok) return bad(parsed.error);
    for (let i = 0; i < parsed.rules.length; i++) {
      const rule = parsed.rules[i];
      const urls = 'split' in rule ? rule.split.map((s) => s.destination) : [rule.destination];
      for (const u of urls) {
        const err = destinationError(u);
        if (err) return bad(`Rule ${i + 1}: ${err === INVALID_URL ? 'enter a valid URL' : err}`);
      }
    }
    data.rules = parsed.rules as unknown as Prisma.InputJsonValue;
    markPending();
    rulesChanged = true;
  }

  if (input.expiresAt !== undefined) {
    if (input.expiresAt === null) {
      data.expiresAt = null;
    } else {
      const at = typeof input.expiresAt === 'string' ? new Date(input.expiresAt) : new Date(NaN);
      if (Number.isNaN(at.getTime())) return bad('Enter a valid expiry date');
      if (at.getTime() <= now) return bad('Expiry must be in the future');
      data.expiresAt = at;
    }
  }

  if (input.maxClicks !== undefined) {
    if (input.maxClicks === null) {
      data.maxClicks = null;
    } else {
      if (!Number.isInteger(input.maxClicks)) return bad('Click limit must be a whole number');
      if (input.maxClicks < 1 || input.maxClicks > MAX_CLICKS_CAP) {
        return bad('Max clicks must be between 1 and 1,000,000,000');
      }
      if (input.maxClicks <= current.clickCount) {
        return bad(`Click limit must be more than the ${current.clickCount} clicks so far`);
      }
      data.maxClicks = input.maxClicks;
    }
  }

  // Revive an expired link only when neither limit still blocks it.
  if (input.expiresAt !== undefined || input.maxClicks !== undefined) {
    const expiresAt = input.expiresAt !== undefined ? (data.expiresAt as Date | null) : (current.expiresAt ?? null);
    const maxClicks = input.maxClicks !== undefined ? (data.maxClicks as number | null) : (current.maxClicks ?? null);
    if ((expiresAt === null || expiresAt.getTime() > now) && (maxClicks === null || maxClicks > current.clickCount)) {
      data.expiredAt = null;
    }
  }

  if (input.password !== undefined) {
    if (input.password === null) {
      data.passwordHash = null;
    } else {
      if (
        typeof input.password !== 'string' ||
        input.password.length < PASSWORD_MIN ||
        input.password.length > PASSWORD_MAX
      ) {
        return bad(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`);
      }
      data.passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    }
  }

  if (input.permanent !== undefined) {
    if (typeof input.permanent !== 'boolean') return bad('Invalid input');
    data.permanent = input.permanent;
  }

  return { ok: true, data, destinationChanged, rulesChanged };
}

/** Shape a stored row for the client. Never includes the password hash. */
export function toLinkSettings(
  row: {
    rules: unknown;
    expiresAt: Date | null;
    maxClicks: number | null;
    passwordHash: string | null;
    permanent: boolean;
  },
  destination: string
): LinkSettings {
  const parsed = row.rules == null ? null : parseRules(row.rules);
  return {
    destination,
    rules: parsed?.ok ? parsed.rules : [],
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    maxClicks: row.maxClicks,
    hasPassword: !!row.passwordHash,
    permanent: row.permanent
  };
}
