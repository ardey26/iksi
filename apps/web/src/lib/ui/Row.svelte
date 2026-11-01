<script>
  // A list row: leading media, primary + secondary text, trailing meta
  // (right-aligned, tabular) and actions. 56px minimum.
  /** Primary text (or use the default slot). */
  export let title = '';
  /** Secondary line. */
  export let subtitle = '';
  /** Paint a hover fill, for rows that respond to the pointer. */
  export let interactive = false;
  /** Dim the row while it is being removed or is unavailable. */
  export let muted = false;
  let className = '';
  export { className as class };
</script>

<li class="row {className}" class:interactive class:muted {...$$restProps}>
  {#if $$slots.leading}<div class="leading"><slot name="leading" /></div>{/if}
  <div class="text">
    <div class="title"><slot>{title}</slot></div>
    {#if $$slots.subtitle || subtitle}
      <div class="subtitle"><slot name="subtitle">{subtitle}</slot></div>
    {/if}
  </div>
  {#if $$slots.meta}<div class="meta"><slot name="meta" /></div>{/if}
  {#if $$slots.actions}<div class="actions"><slot name="actions" /></div>{/if}
</li>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 16px;
    transition: background-color var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-out);
  }
  .interactive:hover { background-color: var(--surface-2); }
  .muted { opacity: 0.5; }
  .leading {
    display: flex;
    flex: none;
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .title {
    overflow: hidden;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .subtitle {
    overflow: hidden;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta {
    flex: none;
    font-size: 15px;
    line-height: 20px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }
  /* A trailing icon button's glyph lines up with the row's 16px edge. */
  .actions:has(> :global(button:last-child)) { margin-right: -8px; }
  /* Phones: 32px buttons 12px apart give each a 44px target. */
  @media (max-width: 639px) {
    .actions { gap: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .row { transition: none; }
  }
</style>
