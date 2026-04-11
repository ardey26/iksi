import { redirect } from '@sveltejs/kit';
import { twitter } from '$lib/server/oauth.js';
import { generateState, generateCodeVerifier } from 'arctic';

export const GET = async ({ cookies }) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = twitter().createAuthorizationURL(state, codeVerifier, [
    'tweet.read',
    'users.read'
  ]);

  cookies.set('twitter_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10
  });

  cookies.set('twitter_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10
  });

  throw redirect(302, url.toString());
};
