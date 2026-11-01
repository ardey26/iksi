<script>
  import Icon from './Icon.svelte';

  /** Icon name. */
  export let icon;
  /** Accessible name, also the hover tooltip. Required: there is no visible text. */
  export let label;
  /** sm 32 | md 40 (44 on phones) */
  export let size = 'sm';
  /** ghost | secondary | danger */
  export let variant = 'ghost';
  export let type = 'button';
  export let disabled = false;
  let className = '';
  export { className as class };
</script>

<button
  data-ui
  class="icon-btn {variant} {size} {className}"
  {type}
  {disabled}
  aria-label={label}
  title={label}
  {...$$restProps}
  on:click
>
  <Icon name={icon} size={size === 'md' ? 20 : 16} />
</button>

<style>
  .icon-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--s);
    height: var(--s);
    padding: 0;
    color: var(--text-muted);
    background-color: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      color var(--duration-normal) var(--ease-out);
  }
  .sm { --s: var(--control-sm); }
  .md { --s: var(--control); }
  .icon-btn:hover:not(:disabled) {
    color: var(--text-primary);
    background-color: var(--surface-2);
  }
  .secondary {
    color: var(--text-primary);
    background-color: var(--surface);
    border-color: var(--border);
  }
  .secondary:hover:not(:disabled) { border-color: var(--border-strong); }
  .danger:hover:not(:disabled) {
    color: var(--error);
    background-color: color-mix(in srgb, var(--error) 10%, transparent);
  }
  .icon-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .icon-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  @media (max-width: 639px) {
    .sm::after {
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
    .icon-btn { transition: none; }
  }
</style>
