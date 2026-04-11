import { redirect } from '@sveltejs/kit';
import { twitter } from '$lib/server/oauth.js';
import { prisma } from '$lib/prisma.js';
import { createUserSession } from '$lib/server/auth.js';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export const GET = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('twitter_oauth_state');
  const codeVerifier = cookies.get('twitter_code_verifier');

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    throw redirect(302, '/?error=oauth_failed');
  }

  // Clean up OAuth cookies
  cookies.delete('twitter_oauth_state', { path: '/' });
  cookies.delete('twitter_code_verifier', { path: '/' });

  let tokens;
  try {
    tokens = await twitter().validateAuthorizationCode(code, codeVerifier);
  } catch {
    throw redirect(302, '/?error=oauth_failed');
  }

  // Fetch user profile from Twitter
  const response = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url', {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` }
  });

  if (!response.ok) {
    throw redirect(302, '/?error=oauth_failed');
  }

  const { data: profile } = await response.json();
  const providerId = profile.id;
  const name = profile.name || null;
  const avatarUrl = profile.profile_image_url || null;

  // Find or create user (Twitter doesn't provide email without elevated access)
  const user = await prisma.user.upsert({
    where: {
      provider_providerId: { provider: 'twitter', providerId }
    },
    update: { name, avatarUrl },
    create: { provider: 'twitter', providerId, name, avatarUrl }
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
