<script lang="ts">
  // A connect request that is not ours (wrong extension, bad state): never a
  // redirect, just this page.
  import { Button } from '#lib/ui/index.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
</script>

<svelte:head>
  <title>Cannot connect | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<Interstitial
  icon="alert"
  title="This connect link does not work"
  description="Close this window, then choose Connect to iksi in the extension again."
>
  <Button variant="secondary" size="lg" full href="/dashboard">Go to your dashboard</Button>
</Interstitial>
