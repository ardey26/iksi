<script>
  import Icon from './Icon.svelte';

  /** Icon name. */
  export let icon = 'inbox';
  /** The one line. */
  export let title;
  /** Optional quieter line under it. */
  export let description = '';
  /** section (inside a list or paper) | page (interstitials: Title role, more air) */
  export let variant = 'section';
  /** Heading level for the page variant. */
  export let level = 1;
</script>

<div class="empty {variant}">
  {#if $$slots.media}
    <!-- Artwork that brings its own shape (the brand mark): no tile. -->
    <span class="media"><slot name="media" /></span>
  {:else}
    <span class="icon"><Icon name={icon} size={20} /></span>
  {/if}
  {#if variant === 'page'}
    <svelte:element this={`h${level}`} class="title t-title">{title}</svelte:element>
  {:else}
    <p class="title">{title}</p>
  {/if}
  {#if description}<p class="desc">{description}</p>{/if}
  {#if $$slots.default}<div class="action"><slot /></div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 24px;
    text-align: center;
  }
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-bottom: 16px;
    color: var(--text-muted);
    background-color: var(--surface-2);
    border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .title {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--text-primary);
    text-wrap: balance;
  }
  .desc {
    max-width: 360px;
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
    text-wrap: balance;
  }
  .media {
    display: inline-flex;
    margin-bottom: 16px;
    color: var(--text-muted);
  }
  .action { margin-top: 20px; }

  .page { padding: 16px 0 0; }
  .page .icon {
    width: 48px;
    height: 48px;
    margin-bottom: 20px;
    border-radius: 14px;
  }
  .page .media { margin-bottom: 20px; }
  .page .title {
    font-size: 20px;
    line-height: 26px;
    font-weight: 600;
  }
  .page .desc {
    max-width: none;
    margin-top: 8px;
    font-size: 15px;
    line-height: 22px;
  }
  .page .action {
    align-self: stretch;
    margin-top: 32px;
  }
</style>
