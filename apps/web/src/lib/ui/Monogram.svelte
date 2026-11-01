<script>
  // Stand-in for a missing logo: the first letter on --surface-2.
  export let name = '';
  /** 32 | 40 */
  export let size = 40;

  $: letter = (name.trim().match(/\p{L}|\p{N}/u)?.[0] ?? '?').toUpperCase();
</script>

<span class="mono" style="--size: {size}px;" aria-hidden="true">{letter}</span>

<style>
  .mono {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    font-size: calc(var(--size) * 0.4);
    line-height: 1;
    font-weight: 600;
    color: var(--text-muted);
    background-color: var(--surface-2);
    border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 1px var(--border);
    user-select: none;
  }
</style>
