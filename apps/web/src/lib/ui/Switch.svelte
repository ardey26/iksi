<script>
  import { createEventDispatcher } from 'svelte';

  export let checked = false;
  export let disabled = false;
  /** Accessible name when no visible label points at the switch. */
  export let label = undefined;
  export let id = undefined;
  /** id(s) of a visible label and description, when the switch sits in a row. */
  export let labelledby = undefined;
  export let describedby = undefined;

  const dispatch = createEventDispatcher();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    dispatch('change', { checked });
  }
</script>

<button
  data-ui
  type="button"
  role="switch"
  class="switch"
  {id}
  {disabled}
  aria-checked={checked ? 'true' : 'false'}
  aria-label={labelledby ? undefined : label}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  {...$$restProps}
  on:click={toggle}
>
  <span class="thumb" aria-hidden="true"></span>
</button>

<style>
  .switch {
    position: relative;
    display: inline-flex;
    flex: none;
    width: 36px;
    height: 20px;
    padding: 0;
    background-color: var(--switch-off);
    border: 0;
    border-radius: var(--radius-pill);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--duration-normal) var(--ease-out);
  }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: #FFFFFF;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    transition: transform var(--duration-normal) var(--ease-out);
  }
  .switch[aria-checked='true'] { background-color: var(--accent); }
  .switch[aria-checked='true'] .thumb { transform: translateX(16px); }
  .switch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .switch:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  @media (max-width: 639px) {
    .switch::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 48px;
      height: 44px;
      transform: translate(-50%, -50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .switch,
    .thumb { transition: none; }
  }
</style>
