<script>
  // The toast region. Mount once per layout; call toast() from anywhere.
  import { fly } from 'svelte/transition';
  import { toasts, dismiss } from './toast.js';
  import Icon from './Icon.svelte';
  import { motion } from './motion.js';

  const ICON = { success: 'check-circle', error: 'alert' };
</script>

<!-- The live region is always in the tree, so every new message is announced. -->
<div class="region" role="status" aria-live="polite" aria-atomic="false">
  {#each $toasts as t (t.id)}
    <div class="toast {t.variant}" transition:fly={motion({ y: 8, duration: 150 })}>
      {#if ICON[t.variant]}<span class="icon"><Icon name={ICON[t.variant]} /></span>{/if}
      <p class="message">{t.message}</p>
      <button data-ui type="button" class="close" aria-label="Dismiss" on:click={() => dismiss(t.id)}>
        <Icon name="x" />
      </button>
    </div>
  {/each}
</div>

<style>
  .region {
    position: fixed;
    left: 50%;
    bottom: max(24px, env(safe-area-inset-bottom));
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: calc(100vw - 32px);
    transform: translateX(-50%);
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 100%;
    min-height: 44px;
    padding: 0 6px 0 16px;
    color: var(--text-primary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    box-shadow: var(--overlay-shadow);
    pointer-events: auto;
  }
  .icon { display: inline-flex; }
  .success .icon { color: var(--success); }
  .error .icon { color: var(--error); }
  .message {
    margin: 0;
    overflow: hidden;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    padding: 0;
    color: var(--text-faint);
    background-color: transparent;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
  }
  .close:hover { color: var(--text-primary); background-color: var(--surface-2); }
  .close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 0;
  }
</style>
