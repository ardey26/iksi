import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { dev } from '$app/environment';
import * as twitter from '$lib/server/twitter-oauth';
import * as google from '$lib/server/google-oauth';

const cookieOpts = () => ({
  path: '/',
  httpOnly: true,
  secure: !dev,
  sameSite: 'lax' as const,
  maxAge: 60 * 10
});

export const actions: Actions = {
  twitter: async ({ cookies }) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_REDIRECT_URI;
    if (!clientId || !redirectUri) return { error: 'Twitter OAuth not configured' };

    const { verifier, challenge } = twitter.generatePKCE();
    const state = twitter.generateState();
    cookies.set('oauth_pkce', verifier, cookieOpts());
    cookies.set('oauth_state', state, cookieOpts());

    throw redirect(302, twitter.buildAuthorizeURL({ clientId, redirectUri, state, codeChallenge: challenge }));
  },

  google: async ({ cookies }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) return { error: 'Google OAuth not configured' };

    const { verifier, challenge } = google.generatePKCE();
    const state = google.generateState();
    cookies.set('oauth_pkce', verifier, cookieOpts());
    cookies.set('oauth_state', state, cookieOpts());

    throw redirect(302, google.buildAuthorizeURL({ clientId, redirectUri, state, codeChallenge: challenge }));
  }
};
