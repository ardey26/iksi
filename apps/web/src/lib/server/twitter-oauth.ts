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
    scope: 'users.read tweet.read offline.access',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256'
  });
  return `https://twitter.com/i/oauth2/authorize?${p.toString()}`;
}

export type TwitterUser = { id: string; username: string; name: string; profileImageUrl: string | null };

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
    redirect_uri: opts.redirectUri,
    code_verifier: opts.verifier
  });
  const basicAuth = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64');
  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`
    },
    body: body.toString()
  });
  if (!res.ok) throw new Error(`Twitter token exchange failed: ${res.status}`);
  const json = await res.json();
  return { accessToken: json.access_token as string };
}

export async function fetchMe(accessToken: string): Promise<TwitterUser> {
  const res = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Twitter /users/me failed: ${res.status} — ${body}`);
  }
  const json = await res.json();
  const d = json.data;
  return {
    id: d.id,
    username: d.username,
    name: d.name,
    profileImageUrl: d.profile_image_url ?? null
  };
}
