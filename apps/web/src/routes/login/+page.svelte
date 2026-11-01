<script lang="ts">
  // Sign in (DESIGN.md › Layout): a public interstitial. One paper with the
  // brand mark, a Title, one line and the two providers; home below it.
  import { page } from '$app/state';
  import { Button } from '#lib/ui/index.js';
  import { appHref } from '#lib/subdomains.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  export let form: { error?: string } | null = null;

  let pending: 'twitter' | 'google' | null = null;

  $: home = appHref('/', page.url?.host ?? '', import.meta.env.DEV);
</script>

<svelte:head><title>Sign in | iksi</title></svelte:head>

<Interstitial title="Sign in to iksi" description="Claim your handle and turn iksi.app/@you into your public page.">
  <svelte:fragment slot="media"><BrandMark size={48} /></svelte:fragment>

  <div class="providers">
    <form method="POST" action="?/twitter" on:submit={() => (pending = 'twitter')}>
      <Button type="submit" variant="primary" size="lg" full disabled={pending === 'google'} loading={pending === 'twitter'}>
        <svg slot="icon" data-provider="x" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        Continue with X
      </Button>
    </form>

    <form method="POST" action="?/google" on:submit={() => (pending = 'google')}>
      <Button type="submit" variant="secondary" size="lg" full disabled={pending === 'twitter'} loading={pending === 'google'}>
        <svg slot="icon" data-provider="google" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </Button>
    </form>

    <!-- Reserved, so an error never moves the buttons. -->
    <p class="status t-label" role={form?.error ? 'alert' : undefined}>{form?.error ?? ''}</p>
  </div>

  <a slot="below" class="home" href={home}>Back to home</a>
</Interstitial>

<style>
  .providers {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .status {
    min-height: 18px;
    margin: 0;
    text-align: center;
    color: var(--error);
  }
  .home {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    padding: 12px 8px;
    border-radius: var(--radius-control);
  }
  .home:hover { color: var(--text-primary); }
  .home:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
</style>
