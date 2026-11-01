<script lang="ts">
  // Connect the extension (DESIGN.md › Layout): a public interstitial with the
  // brand mark, a Title, one line and the choice. Plain form posts, so the
  // browser follows the 303 to chromiumapp.org, where Chrome hands the result
  // to the extension.
  import { Button } from '#lib/ui/index.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  export let data: { redirectUri: string; state: string; account: string };

  let pending: 'allow' | 'cancel' | null = null;
</script>

<svelte:head>
  <title>Connect the extension | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<Interstitial
  title="Connect the iksi extension?"
  description="It will shorten links as {data.account}. You can disconnect it any time in your dashboard."
>
  <svelte:fragment slot="media"><BrandMark size={48} /></svelte:fragment>

  <div class="choices">
    <form method="POST" action="?/allow" on:submit={() => (pending = 'allow')}>
      <input type="hidden" name="redirect_uri" value={data.redirectUri} />
      <input type="hidden" name="state" value={data.state} />
      <Button type="submit" variant="primary" size="lg" full disabled={pending === 'cancel'} loading={pending === 'allow'}>Allow</Button>
    </form>
    <form method="POST" action="?/cancel" on:submit={() => (pending = 'cancel')}>
      <input type="hidden" name="redirect_uri" value={data.redirectUri} />
      <input type="hidden" name="state" value={data.state} />
      <Button type="submit" variant="secondary" size="lg" full disabled={pending === 'allow'} loading={pending === 'cancel'}>Cancel</Button>
    </form>
  </div>
</Interstitial>

<style>
  .choices {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
