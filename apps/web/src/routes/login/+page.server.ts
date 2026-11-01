import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { dev } from '$app/env';
import * as twitter from '#lib/server/twitter-oauth.js';
import * as google from '#lib/server/google-oauth.js';
import { rememberNext, safeNext } from '#lib/server/login-return.js';

const cookieOpts = () => ({
  path: '/',
  httpOnly: true,
  secure: !dev,
  sameSite: 'lax' as const,
  maxAge: 60 * 10
});

/** `?next=` (a page that sent the visitor to sign in) goes to the forms. */
export const load = ({ url }: { url: URL }) => ({ next: safeNext(url.searchParams.get('next')) });

/** Kept in a cookie for the OAuth round trip; the callback checks it again. */
async function keepNext(request: Request, cookies: Parameters<typeof rememberNext>[0]) {
  const form = await request.formData().catch(() => null);
  rememberNext(cookies, form?.get('next'), dev);
}

export const actions: Actions = {
  twitter: async ({ cookies, request }) => {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const redirectUri = process.env.TWITTER_REDIRECT_URI;
    if (!clientId || !redirectUri) return { error: 'Twitter OAuth not configured' };
    await keepNext(request, cookies);

    const { verifier, challenge } = twitter.generatePKCE();
    const state = twitter.generateState();
    cookies.set('oauth_pkce', verifier, cookieOpts());
    cookies.set('oauth_state', state, cookieOpts());

    redirect(302, twitter.buildAuthorizeURL({ clientId, redirectUri, state, codeChallenge: challenge }), {
      external: ['https://twitter.com']
    });
  },

  google: async ({ cookies, request }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) return { error: 'Google OAuth not configured' };
    await keepNext(request, cookies);

    const { verifier, challenge } = google.generatePKCE();
    const state = google.generateState();
    cookies.set('oauth_pkce', verifier, cookieOpts());
    cookies.set('oauth_state', state, cookieOpts());

    redirect(302, google.buildAuthorizeURL({ clientId, redirectUri, state, codeChallenge: challenge }), {
      external: ['https://accounts.google.com']
    });
  }
};
