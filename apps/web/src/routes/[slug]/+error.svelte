<script>
  import { page } from '$app/state';
  import LinkNotice from '#lib/components/LinkNotice.svelte';

  let view = $derived(page.error?.view);
  let title = $derived(
    view === 'expired' ? 'Link expired' : view === 'flagged' ? 'Link disabled' : 'Not found'
  );
</script>

<svelte:head>
  <title>{title} | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex-1 flex items-center justify-center">
  <div class="w-full max-w-[500px] text-center">
    {#if view === 'expired' || view === 'flagged'}
      <LinkNotice {view} verdict={page.error?.verdict} />
    {:else}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">Nothing here</h1>
      <p class="mt-2 text-sm" style="color: var(--text-muted);">
        This short link isn't pointing anywhere yet. Claim it if you want.
      </p>
      <a href="/" class="inline-block mt-6 text-sm hover:opacity-70 transition-opacity" style="color: var(--accent);">
        Back to iksi
      </a>
    {/if}
  </div>
</div>
