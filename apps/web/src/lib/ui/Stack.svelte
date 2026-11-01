<script>
  // Layout glue: a flex column (or row) with a gap from the spacing scale.
  /** column | row */
  export let direction = 'column';
  /** Gap in px: 4, 8, 12, 16, 24, 32, 48, 64. */
  export let gap = 16;
  /** CSS align-items. */
  export let align = 'stretch';
  /** CSS justify-content. */
  export let justify = 'flex-start';
  export let wrap = false;
  export let as = 'div';
  let className = '';
  export { className as class };
</script>

<svelte:element
  this={as}
  class="stack {className}"
  style="--dir: {direction}; --gap: {gap}px; --align: {align}; --justify: {justify}; --wrap: {wrap ? 'wrap' : 'nowrap'};"
  {...$$restProps}
>
  <slot />
</svelte:element>

<style>
  .stack {
    display: flex;
    flex-direction: var(--dir);
    flex-wrap: var(--wrap);
    align-items: var(--align);
    justify-content: var(--justify);
    gap: var(--gap);
    min-width: 0;
  }
</style>
