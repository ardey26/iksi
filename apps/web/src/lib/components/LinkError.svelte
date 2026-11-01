<script>
  import { page } from '$app/state';
  import { Button } from '#lib/ui/index.js';
  import { appHref } from '#lib/subdomains.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
  import LinkNotice from '#lib/components/LinkNotice.svelte';

  let view = $derived(page.error?.view);
  let title = $derived(
    view === 'expired'
      ? 'Link expired'
      : view === 'opened'
        ? 'Link opened'
        : view === 'flagged'
          ? page.error?.verdict === 'review'
            ? 'Link under review'
            : 'Link disabled'
          : 'Not found'
  );
  // On a profile subdomain `/` is the profile; the shortener is on www.
  const home = $derived(appHref('/', page.url?.host ?? '', import.meta.env.DEV));
</script>

<svelte:head>
  <title>{title} | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if view === 'expired' || view === 'opened' || view === 'flagged'}
  <LinkNotice {view} verdict={page.error?.verdict} />
{:else}
  <Interstitial
    icon="search"
    title="Nothing here"
    description="This short link isn't pointing anywhere yet. Claim it if you want."
  >
    <Button variant="primary" size="lg" full href={home}>Shorten a link</Button>
  </Interstitial>
{/if}
