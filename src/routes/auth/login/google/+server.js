import { redirect } from '@sveltejs/kit';
import { google } from '$lib/server/oauth.js';
import { generateState, generateCodeVerifier } from 'arctic';

export const GET = async ({ cookies }) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google().createAuthorizationURL(state, codeVerifier, [
    'openid',
    'profile',
    'email'
  ]);

  cookies.set('google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  cookies.set('google_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10
  });

  throw redirect(302, url.toString());
};
