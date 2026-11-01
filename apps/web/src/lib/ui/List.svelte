<script>
  // Rows separated by hairlines. Put it in <Paper padding="none"> to group.
  export let label = undefined;
  let className = '';
  export { className as class };
</script>

<ul class="list {className}" role="list" aria-label={label} {...$$restProps}>
  <slot />
</ul>

<style>
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: inherit;
  }
  .list > :global(li + li) { border-top: 1px solid var(--border); }
</style>
