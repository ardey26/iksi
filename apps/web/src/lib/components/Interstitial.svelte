<script>
  // A public interstitial (DESIGN.md › Layout): a centered 480 column, one
  // paper, an icon (or the `media` slot: the brand mark), a Title, one line
  // and one action (the default slot).
  // Used by every short-link page and the error pages.
  import { Container, EmptyState, Paper, Stack } from '#lib/ui/index.js';

  export let icon = 'link';
  export let title;
  export let description = '';
</script>

<Container width="narrow" class="interstitial">
  <Stack gap={16}>
    <Paper>
      {#if $$slots.media}
        <EmptyState variant="page" {icon} {title} {description}>
          <svelte:fragment slot="media"><slot name="media" /></svelte:fragment>
          <slot />
        </EmptyState>
      {:else if $$slots.default}
        <EmptyState variant="page" {icon} {title} {description}><slot /></EmptyState>
      {:else}
        <EmptyState variant="page" {icon} {title} {description} />
      {/if}
    </Paper>
    {#if $$slots.below}
      <div class="below t-caption t-faint"><slot name="below" /></div>
    {/if}
  </Stack>
</Container>

<style>
  /* Generous top space, the same on every interstitial, so moving between
     them (password, then reveal) never shifts the paper. */
  :global(.interstitial) {
    padding-top: clamp(24px, 10vh, 112px);
    padding-bottom: 64px;
  }
  .below {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    column-gap: 16px;
    text-align: center;
  }
  /* A quiet text link in the footer line ("Report this link"). 44px tall to
     tap, without moving the line. */
  .below :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin: -14px 0;
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    border-radius: 4px;
    transition: color var(--duration-normal) var(--ease-out);
  }
  .below :global(a:hover) { color: var(--text-muted); }
  .below :global(a:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
