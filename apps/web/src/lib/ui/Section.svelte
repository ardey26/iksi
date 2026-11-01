<script>
  import { uid } from './uid.js';

  export let title = '';
  /** One line under the title. */
  export let description = '';
  /** Heading level for the title. */
  export let level = 2;
  /** Names the section, so `#id` links land on it; the title is `id-title`. */
  export let id = uid('section');
  let className = '';
  export { className as class };
</script>

<section {id} class="section ui-section {className}" aria-labelledby={title ? `${id}-title` : undefined} {...$$restProps}>
  {#if title}
    <header class="head">
      <div class="text">
        <svelte:element this={`h${level}`} id="{id}-title" class="t-title title">{title}</svelte:element>
        {#if description}<p class="desc">{description}</p>{/if}
      </div>
      {#if $$slots.actions}<div class="actions"><slot name="actions" /></div>{/if}
    </header>
  {/if}
  <slot />
</section>

<style>
  .section { min-width: 0; }
  /* 48px between sections, across instances. */
  :global(.ui-section + .ui-section) { margin-top: 48px; }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .text {
    flex: 1 1 240px;
    min-width: 0;
  }
  .title {
    margin: 0;
    color: var(--text-primary);
  }
  .desc {
    margin: 4px 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
</style>
