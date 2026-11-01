<script>
  // Paper on canvas: one level only, never paper inside paper.
  /** none (lists run edge to edge) | sm 16 | md 24 */
  export let padding = 'md';
  /** Element to render: div, section, article, form... */
  export let as = 'div';
  let className = '';
  export { className as class };
</script>

<svelte:element this={as} class="paper pad-{padding} {className}" {...$$restProps} on:submit>
  <slot />
</svelte:element>

<style>
  .paper {
    min-width: 0;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
    box-shadow: var(--paper-shadow);
  }
  .pad-none { overflow: hidden; }
  .pad-sm { padding: 16px; }
  .pad-md { padding: 24px; }
  @media (max-width: 639px) {
    .pad-md { padding: 20px 16px; }
  }
</style>
