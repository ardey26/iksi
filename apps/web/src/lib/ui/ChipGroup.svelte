<script>
  // Multi-select from a small set: checkbox chips. The mark slot is always
  // drawn (plus or check), so selecting never changes a chip's width.
  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';

  /** [{ value, label, disabled? }] */
  export let options = [];
  /** Selected values. */
  export let value = [];
  export let label = undefined;
  export let labelledby = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  function toggle(v, on) {
    value = on ? [...value, v] : value.filter((x) => x !== v);
    dispatch('change', { value });
  }
</script>

<div
  class="chips"
  role="group"
  aria-label={labelledby ? undefined : label}
  aria-labelledby={labelledby}
>
  {#each options as o (o.value)}
    {@const on = value.includes(o.value)}
    {@const off = disabled || o.disabled}
    <label class="chip" class:on class:off>
      <input
        data-ui
        type="checkbox"
        class="sr-only"
        checked={on}
        disabled={off}
        on:change={(e) => toggle(o.value, e.currentTarget.checked)}
      />
      <span class="mark"><Icon name={on ? 'check' : 'plus'} /></span>
      <span class="text">{o.label}</span>
    </label>
  {/each}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px 0 10px;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text-muted);
    background-color: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      color var(--duration-normal) var(--ease-out);
  }
  .mark {
    display: inline-flex;
    color: var(--text-faint);
  }
  .chip:hover:not(.off) {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .on {
    color: var(--text-primary);
    background-color: color-mix(in srgb, var(--accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .chip.on:hover:not(.off) { border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
  .on .mark { color: var(--accent); }
  .chip:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .off {
    opacity: 0.4;
    cursor: not-allowed;
  }
  @media (max-width: 639px) {
    .chips { row-gap: 12px; }
    .chip::after {
      content: '';
      position: absolute;
      inset: -6px 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chip { transition: none; }
  }
</style>
