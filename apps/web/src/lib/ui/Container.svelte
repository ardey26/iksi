<script>
  // Page column with the standard gutters (16 phone, 32 from 768).
  /** narrow 480 (public pages) | form 720 | wide 960 (tables) */
  export let width = 'form';
  export let as = 'div';
  let className = '';
  export { className as class };
</script>

<svelte:element this={as} class="page-column {width} {className}" {...$$restProps}>
  <slot />
</svelte:element>

<style>
  .page-column {
    width: 100%;
    margin-inline: auto;
    padding-inline: var(--gutter);
  }
  .narrow { max-width: calc(var(--width-narrow) + var(--gutter) * 2); }
  .form { max-width: calc(var(--width-form) + var(--gutter) * 2); }
  .wide { max-width: calc(var(--width-wide) + var(--gutter) * 2); }
</style>
