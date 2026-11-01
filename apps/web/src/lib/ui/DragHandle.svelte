<script>
  // The grip at the start of a reorderable row. Pass the `handle` slot prop
  // from <SortableList>; the handle is the only place a row can be lifted.
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  /** From SortableList's slot props. Leave it out for a loading placeholder
      with the same footprint. */
  export let handle = undefined;

  let el;
  onMount(() => handle?.register(el));
</script>

{#if !handle}
  <span class="handle placeholder" aria-hidden="true"><Icon name="grip" /></span>
{:else}
<button
  data-ui
  bind:this={el}
  type="button"
  class="handle"
  aria-label={handle.label}
  aria-describedby={handle.describedby}
  disabled={handle.disabled}
  on:keydown={handle.keydown}
  on:blur={handle.blur}
  on:pointerdown={handle.pointerdown}
  on:contextmenu={handle.contextmenu}
>
  <Icon name="grip" />
</button>
{/if}

<style>
  .handle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 24px;
    height: 32px;
    margin-left: -6px;
    padding: 0;
    color: var(--text-faint);
    background-color: transparent;
    border: 0;
    border-radius: 6px;
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    transition: color var(--duration-normal) var(--ease-out), background-color var(--duration-normal) var(--ease-out);
  }
  .handle:hover:not(:disabled) {
    color: var(--text-primary);
    background-color: var(--surface-2);
  }
  .handle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
  .placeholder {
    opacity: 0.35;
    cursor: default;
  }
  .handle:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  :global([data-sort-lifted]) .handle {
    color: var(--text-primary);
    cursor: grabbing;
  }
  @media (max-width: 639px) {
    .handle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 44px;
      height: 44px;
      transform: translate(-50%, -50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .handle { transition: none; }
  }
</style>
