import { redirect } from '@sveltejs/kit';
import { google } from '$lib/server/oauth.js';
import { prisma } from '$lib/prisma.js';
import { createUserSession } from '$lib/server/auth.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export const GET = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('google_oauth_state');
  const codeVerifier = cookies.get('google_code_verifier');

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    throw redirect(302, '/?error=oauth_failed');
  }

  // Clean up OAuth cookies
  cookies.delete('google_oauth_state', { path: '/' });
  cookies.delete('google_code_verifier', { path: '/' });

  let tokens;
  try {
    tokens = await google().validateAuthorizationCode(code, codeVerifier);
  } catch {
    throw redirect(302, '/?error=oauth_failed');
  }

  // Fetch user profile from Google
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` }
  });

  if (!response.ok) {
    throw redirect(302, '/?error=oauth_failed');
  }

  const profile = await response.json();
  const providerId = profile.sub;
  const email = profile.email || null;
  const name = profile.name || null;
  const avatarUrl = profile.picture || null;

  // Find or create user
  const user = await prisma.user.upsert({
    where: {
      provider_providerId: { provider: 'google', providerId }
    },
    update: { email, name, avatarUrl },
    create: { provider: 'google', providerId, email, name, avatarUrl }
  });

  // Create session
  const token = await createUserSession(user.id);

  cookies.set('session', token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE
  });

  throw redirect(302, '/');
};
