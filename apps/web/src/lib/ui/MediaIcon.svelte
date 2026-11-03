<script>
  import Icon from './Icon.svelte';

  // What a row's leading media shows when there is no real image (no
  // favicon, no logo): a bare icon that says what the row is, centred in the
  // same box a Logo takes, so text columns line up. No tile, fill or border.
  /** Icon name: a key of Icon's ICONS. */
  export let name;
  /** Box size in px, matching Logo: 32 | 40. */
  export let size = 40;
  /** Accessible name. Empty when the row's own text already says what it is. */
  export let label = '';
</script>

<span class="media-icon" style="--size: {size}px;">
  <Icon {name} {label} size={18} />
</span>

<style>
  .media-icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    color: var(--text-muted);
  }
</style>
