<script>
  import Icon from './Icon.svelte';
  import Spinner from './Spinner.svelte';

  /** primary (one per view) | secondary | ghost | danger */
  export let variant = 'secondary';
  /** sm 32 | md 40 (44 on phones) | lg 48 */
  export let size = 'md';
  export let type = 'button';
  /** Renders a link styled as a button. */
  export let href = undefined;
  export let disabled = false;
  /** Disables the button and shows a spinner; the label keeps its width. */
  export let loading = false;
  /** Leading icon name. For artwork outside the kit set (a provider's mark), use the `icon` slot. */
  export let icon = undefined;
  /** Trailing icon name. */
  export let iconEnd = undefined;
  /** Stretch to the container's width. */
  export let full = false;
  let className = '';
  export { className as class };
</script>

{#if href}
  <a
    data-ui
    class="btn {variant} {size} {className}"
    class:full
    class:lead={icon || $$slots.icon}
    class:trail={iconEnd}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    tabindex={disabled ? -1 : undefined}
    {...$$restProps}
    on:click
  >
    <span class="content">
      {#if $$slots.icon}<span class="glyph"><slot name="icon" /></span>{:else if icon}<Icon name={icon} />{/if}
      <span class="label"><slot /></span>
      {#if iconEnd}<Icon name={iconEnd} />{/if}
    </span>
  </a>
{:else}
  <button
    data-ui
    class="btn {variant} {size} {className}"
    class:full
    class:loading
    class:lead={icon || $$slots.icon}
    class:trail={iconEnd}
    {type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...$$restProps}
    on:click
  >
    <span class="content">
      {#if $$slots.icon}<span class="glyph"><slot name="icon" /></span>{:else if icon}<Icon name={icon} />{/if}
      <span class="label"><slot /></span>
      {#if iconEnd}<Icon name={iconEnd} />{/if}
    </span>
    {#if loading}<span class="busy"><Spinner /></span>{/if}
  </button>
{/if}

<style>
  .btn {
    --h: var(--control);
    --px: 16px;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    height: var(--h);
    padding: 0 var(--px);
    font: inherit;
    font-size: 14px;
    line-height: 1;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
    color: var(--text-primary);
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      color var(--duration-normal) var(--ease-out),
      opacity var(--duration-normal) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }
  .content {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .glyph {
    display: inline-flex;
    flex: none;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sm { --h: var(--control-sm); --px: 12px; font-size: 13px; }
  .sm .content { gap: 6px; }
  .lg { --h: var(--control-lg); --px: 20px; font-size: 15px; }
  /* Optical balance: an icon reads lighter than text, so its side gets less padding. */
  .lead { padding-left: calc(var(--px) - 2px); }
  .trail { padding-right: calc(var(--px) - 2px); }
  .full { display: flex; width: 100%; }

  .primary {
    color: var(--bg);
    background-color: var(--text-primary);
  }
  .primary:hover:not(:disabled):not([aria-disabled]) {
    background-color: color-mix(in srgb, var(--text-primary) 86%, var(--bg));
  }
  .secondary {
    background-color: var(--surface);
    border-color: var(--border);
  }
  .secondary:hover:not(:disabled):not([aria-disabled]) {
    background-color: var(--surface-2);
    border-color: var(--border-strong);
  }
  .ghost { color: var(--text-muted); }
  .ghost:hover:not(:disabled):not([aria-disabled]) {
    color: var(--text-primary);
    background-color: var(--surface-2);
  }
  .danger { color: var(--error); }
  .danger:hover:not(:disabled):not([aria-disabled]) {
    background-color: color-mix(in srgb, var(--error) 10%, transparent);
  }
  .btn:active:not(:disabled):not([aria-disabled]) { transform: scale(0.98); }

  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn:disabled:not(.loading),
  .btn[aria-disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Loading: the label stays in the layout (and the accessible name) but is
     invisible, so the button never changes width. */
  .loading { cursor: progress; }
  .loading .content { opacity: 0; }
  .busy {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 639px) {
    /* 44px hit area without changing the drawn size. */
    .sm::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: max(100%, 44px);
      height: 44px;
      transform: translate(-50%, -50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .btn { transition: none; }
    .btn:active:not(:disabled) { transform: none; }
  }
</style>
