<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '#lib/ui/index.js';
  import { appHref } from '#lib/subdomains.js';
  import Interstitial from '#lib/components/Interstitial.svelte';

  const missing = $derived(page.status === 404);
</script>

<!-- The root layout skips its <SEO> on /@ routes, so this page sets its own head. -->
<svelte:head>
  <title>{missing ? 'Handle not found' : 'Something went wrong'} — iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="profile-error">
  <Interstitial
    icon={missing ? 'search' : 'alert'}
    title={missing ? 'Handle not found' : 'Something went wrong'}
    description={missing ? 'This handle does not exist.' : 'Try again in a moment.'}
  >
    <Button variant="primary" size="lg" full href={appHref('/', page.url.host, import.meta.env.DEV)}>Go to iksi</Button>
  </Interstitial>
</div>

<style>
  .profile-error {
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--text-primary);
    background-color: var(--bg);
  }
</style>
