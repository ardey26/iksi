import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { generatePKCE, generateState, buildAuthorizeURL } from '$lib/server/twitter-oauth';

export const POST: RequestHandler = async ({ cookies }) => {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const redirectUri = process.env.TWITTER_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return new Response('Twitter OAuth not configured', { status: 500 });
  }

  const { verifier, challenge } = generatePKCE();
  const state = generateState();
  const opts = {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax' as const,
    maxAge: 60 * 10
  };
  cookies.set('oauth_pkce', verifier, opts);
  cookies.set('oauth_state', state, opts);

  throw redirect(302, buildAuthorizeURL({ clientId, redirectUri, state, codeChallenge: challenge }));
};
