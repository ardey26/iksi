export const RESERVED = new Set([
  'admin', 'api', 'app', 'www', 'root', 'help', 'support',
  'about', 'terms', 'privacy', 'login', 'signup', 'logout',
  'dashboard', 'settings', 'links', 'static', 'auth'
]);

const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;

export function validateHandle(input: string | null | undefined): { ok: true; handle: string } | { ok: false; error: string } {
  if (!input) return { ok: false, error: 'Handle required' };
  if (!HANDLE_RE.test(input)) return { ok: false, error: '3–30 chars, lowercase letters/numbers/underscore/hyphen only' };
  if (RESERVED.has(input)) return { ok: false, error: 'That handle is reserved' };
  return { ok: true, handle: input };
}
