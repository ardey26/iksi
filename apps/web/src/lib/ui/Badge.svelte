<script>
  /** neutral | accent | success | warning | error */
  export let variant = 'neutral';
  /** A leading dot, for live status ("Active"). */
  export let dot = false;
  let className = '';
  export { className as class };
</script>

<span class="badge {variant} {className}" {...$$restProps}>
  {#if dot}<span class="dot" aria-hidden="true"></span>{/if}
  <slot />
</span>

<style>
  .badge {
    --c: var(--text-muted);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 20px;
    padding: 0 6px;
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--c);
    background-color: color-mix(in srgb, var(--c) 12%, transparent);
    border-radius: var(--radius-badge);
    font-variant-numeric: tabular-nums;
  }
  .neutral {
    background-color: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .accent { --c: var(--accent); }
  .success { --c: var(--success); }
  .warning { --c: var(--warning); }
  .error { --c: var(--error); }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }
</style>
