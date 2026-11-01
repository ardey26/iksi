<script>
  // A single choice from a few options: a radiogroup with roving focus.
  // Arrow keys move and select (radio semantics); Home and End jump.
  import { createEventDispatcher, onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';

  /** [{ value, label, icon?, disabled? }] */
  export let options = [];
  export let value = undefined;
  /** Accessible name for the group. */
  export let label = undefined;
  export let labelledby = undefined;
  /** sm 32 | md 40 (44 on phones) */
  export let size = 'md';
  /** Equal-width segments that fill the container. */
  export let full = false;
  export let disabled = false;

  const dispatch = createEventDispatcher();
  let buttons = [];
  let thumb = null;
  let measured = false;
  // Transitions start after the first placement, so nothing slides on load.
  let ready = false;

  $: active = options.findIndex((o) => o.value === value);
  $: focusable = active >= 0 ? active : options.findIndex((o) => !o.disabled);

  function select(i, focus = false) {
    const o = options[i];
    if (!o || o.disabled || disabled) return;
    if (focus) buttons[i]?.focus();
    if (o.value === value) return;
    value = o.value;
    dispatch('change', { value });
  }

  function step(from, dir) {
    const n = options.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + dir * k + n * k) % n;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeydown(e, i) {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = step(i, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = step(i, -1);
    else if (e.key === 'Home') next = step(-1 + options.length, 1);
    else if (e.key === 'End') next = step(0, -1);
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  }

  // The thumb slides between segments once it can be measured; until then
  // (and without JS) the active segment paints its own background.
  function place() {
    const b = buttons[active];
    if (!thumb || !b) {
      measured = false;
      return;
    }
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft}px)`;
    measured = b.offsetWidth > 0;
    if (measured && !ready) requestAnimationFrame(() => (ready = true));
  }

  $: active, options, tick().then(place);

  onMount(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    buttons.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  });
</script>

<div
  class="seg {size}"
  class:full
  class:measured
  class:ready
  role="radiogroup"
  aria-label={labelledby ? undefined : label}
  aria-labelledby={labelledby}
  aria-disabled={disabled || undefined}
>
  <span class="thumb" class:none={active < 0} bind:this={thumb} aria-hidden="true"></span>
  {#each options as o, i (o.value)}
    <button
      data-ui
      type="button"
      role="radio"
      class="opt"
      aria-checked={i === active ? 'true' : 'false'}
      tabindex={i === focusable ? 0 : -1}
      disabled={disabled || o.disabled}
      bind:this={buttons[i]}
      on:click={() => select(i)}
      on:keydown={(e) => onKeydown(e, i)}
    >
      {#if o.icon}<Icon name={o.icon} />{/if}
      <span>{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .seg {
    --h: var(--control);
    --pad: 3px;
    position: relative;
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    height: var(--h);
    padding: var(--pad);
    background-color: var(--track);
    border-radius: var(--radius-pill);
    isolation: isolate;
  }
  .sm { --h: var(--control-sm); --pad: 2px; }
  .full { display: flex; width: 100%; }
  .full .opt { flex: 1 1 0; }

  .thumb {
    position: absolute;
    top: var(--pad);
    left: 0;
    z-index: -1;
    height: calc(var(--h) - var(--pad) * 2);
    border-radius: var(--radius-pill);
    background-color: var(--thumb);
    box-shadow: var(--thumb-shadow);
    opacity: 0;
  }
  .ready .thumb {
    transition:
      transform var(--duration-normal) var(--ease-out),
      width var(--duration-normal) var(--ease-out);
  }
  .measured .thumb { opacity: 1; }
  .thumb.none { opacity: 0; }

  .opt {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    height: 100%;
    padding: 0 14px;
    font: inherit;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text-muted);
    background-color: transparent;
    border: 0;
    border-radius: var(--radius-pill);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color var(--duration-normal) var(--ease-out);
  }
  .opt span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sm .opt { padding: 0 10px; }
  .opt:hover:not(:disabled) { color: var(--text-primary); }
  .opt[aria-checked='true'] { color: var(--text-primary); }
  /* Before the thumb is measured, the active segment carries the fill. */
  .seg:not(.measured) .opt[aria-checked='true'] {
    background-color: var(--thumb);
    box-shadow: var(--thumb-shadow);
  }
  .opt:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
  .opt:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  /* Phones: every option is a 44px target. The default track grows by its
     padding so each option is drawn 44px tall; the small one keeps its drawn
     size and gets a 44px hit area, like the small Button. */
  @media (max-width: 639px) {
    .seg:not(.sm) { --h: calc(var(--control) + var(--pad) * 2); }
    .sm .opt::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 44px;
      transform: translateY(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ready .thumb,
    .opt { transition: none; }
  }
</style>
