import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { verifyState, exchangeCode, fetchMe } from '$lib/server/twitter-oauth';
import { createUserSession } from '$lib/server/user-auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = cookies.get('oauth_state');
  const verifier = cookies.get('oauth_pkce');

  cookies.delete('oauth_state', { path: '/' });
  cookies.delete('oauth_pkce', { path: '/' });

  if (!code || !state || !verifier || !verifyState(cookieState, state)) {
    return new Response('OAuth state mismatch', { status: 400 });
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const redirectUri = process.env.TWITTER_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return new Response('Twitter OAuth not configured', { status: 500 });
  }

  let twitterUser;
  try {
    const { accessToken } = await exchangeCode({ clientId, clientSecret, redirectUri, code, verifier });
    twitterUser = await fetchMe(accessToken);
  } catch (err) {
    console.error('OAuth callback failed', err);
    return new Response('OAuth exchange failed', { status: 502 });
  }

  const { prisma } = await import('$lib/prisma.js');
  const user = await prisma.user.upsert({
    where: { twitterId: twitterUser.id },
    create: {
      twitterId: twitterUser.id,
      twitterHandle: twitterUser.username,
      profile: {
        create: {
          displayName: twitterUser.name,
          avatarUrl: twitterUser.profileImageUrl
        }
      }
    },
    update: {
      twitterHandle: twitterUser.username
    },
    include: { handle: true }
  });

  cookies.set('user_session', createUserSession(user.id), {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  });

  throw redirect(302, user.handle ? '/dashboard' : '/dashboard/claim');
};
