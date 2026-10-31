import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export type PKCE = { verifier: string; challenge: string };

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePKCE(): PKCE {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString('hex');
}

export function verifyState(cookieState: string | undefined | null, queryState: string | undefined | null): boolean {
  if (!cookieState || !queryState) return false;
  const a = Buffer.from(cookieState);
  const b = Buffer.from(queryState);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildAuthorizeURL(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: 'openid email profile',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export type GoogleUser = { id: string; email: string; name: string; picture: string | null };

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  verifier: string;
}): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    code: opts.code,
    grant_type: 'authorization_code',
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.verifier
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`Google token exchange failed: ${res.status} — ${text}`);
  }
  const json = await res.json();
  return { accessToken: json.access_token as string };
}

export async function fetchMe(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Google /userinfo failed: ${res.status} — ${body}`);
  }
  const json = await res.json();
  return {
    id: json.sub as string,
    email: json.email as string,
    name: (json.name as string) ?? (json.email as string),
    picture: (json.picture as string) ?? null
  };
}
