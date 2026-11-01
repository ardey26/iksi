<script>
  import Icon from './Icon.svelte';

  export let title;
  /** One line under the title. */
  export let description = '';
  /** Back link above the title. */
  export let back = undefined;
  export let backLabel = 'Back';
</script>

<header class="page-header">
  {#if back}
    <a data-ui class="back" href={back}>
      <Icon name="chevron-left" />
      <span>{backLabel}</span>
    </a>
  {/if}
  <div class="row">
    <div class="text">
      <h1 class="t-display title">{title}</h1>
      {#if description}<p class="desc">{description}</p>{/if}
    </div>
    {#if $$slots.actions}<div class="actions"><slot name="actions" /></div>{/if}
  </div>
</header>

<style>
  .page-header { margin-bottom: 48px; }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 16px -4px;
    padding: 4px 8px 4px 4px;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: var(--radius-pill);
    transition: color var(--duration-normal) var(--ease-out);
  }
  .back:hover { color: var(--text-primary); }
  .back:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .text { min-width: 0; }
  .title {
    margin: 0;
    color: var(--text-primary);
  }
  .desc {
    max-width: 560px;
    margin: 8px 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  @media (min-width: 640px) {
    .row {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
    }
    .actions {
      flex: none;
      padding-bottom: 2px;
    }
  }
  @media (max-width: 639px) {
    .back { min-height: 44px; margin-top: -10px; margin-bottom: 6px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .back { transition: none; }
  }
</style>
