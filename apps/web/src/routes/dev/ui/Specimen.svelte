<script>
  // Gallery chrome: a caption and a row of samples.
  export let label = '';
  /** Stack samples vertically and let them fill the width. */
  export let column = false;
  /** Statically draw the focus ring on the samples. */
  export let focus = false;
</script>

<div class="specimen" class:column class:focus>
  {#if label}<p class="caption">{label}</p>{/if}
  <div class="samples"><slot /></div>
</div>

<style>
  .specimen { min-width: 0; }
  .caption {
    margin: 0 0 12px;
    font-size: 12px;
    line-height: 16px;
    color: var(--text-faint);
  }
  .samples {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .column .samples {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .focus :global(:is(button, a)[data-ui]),
  .focus :global(.chip) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .focus :global(.ui-box) {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
</style>
