import { RESERVED_HANDLES } from '#lib/subdomains.js';
import { handleShapeError } from '#lib/handle-rules.js';

/** Defined with the subdomain rules, so a reserved handle is never a profile host. */
export const RESERVED: ReadonlySet<string> = new Set(RESERVED_HANDLES);

/** Checks a handle being claimed now (#lib/handle-rules). Existing handles are never re-validated. */
export function validateHandle(input: string | null | undefined): { ok: true; handle: string } | { ok: false; error: string } {
  const error = handleShapeError(input ?? '');
  if (error) return { ok: false, error };
  if (RESERVED.has(input!)) return { ok: false, error: 'That handle is reserved' };
  return { ok: true, handle: input! };
}
