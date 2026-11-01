<script context="module">
  // Scroll lock shared by every open sheet.
  let locks = 0;
  let saved = { overflow: '', paddingRight: '' };

  function lockScroll() {
    if (locks++ > 0) return;
    const root = document.documentElement;
    const bar = window.innerWidth - root.clientWidth;
    saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    root.style.overflow = 'hidden';
    if (bar > 0) root.style.paddingRight = `${bar}px`;
  }

  function unlockScroll() {
    if (locks === 0 || --locks > 0) return;
    const root = document.documentElement;
    root.style.overflow = saved.overflow;
    root.style.paddingRight = saved.paddingRight;
  }
</script>

<script>
  // Bottom sheet on phones, side sheet from 768px. Focus moves in on open,
  // stays inside while open (Tab wraps) and returns to the opener on close.
  // Escape, the close button and the scrim all close it.
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import IconButton from './IconButton.svelte';
  import { portal } from './portal.js';
  import { trapTab, focusables } from './focus.js';
  import { reducedMotion } from './motion.js';
  import { uid } from './uid.js';

  export let open = false;
  export let title;
  /** One line under the title. */
  export let description = '';
  /** Side-sheet width from 768px. */
  export let width = 440;
  /** Selector inside the sheet to focus on open. Default: the sheet itself. */
  export let initialFocus = undefined;
  export let id = uid('sheet');

  const dispatch = createEventDispatcher();
  let panel;
  let opener = null;
  let active = false;

  export function close() {
    if (!open) return;
    open = false;
    dispatch('close');
  }

  async function activate() {
    active = true;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockScroll();
    await tick();
    if (!panel) return;
    const target = initialFocus ? panel.querySelector(initialFocus) : null;
    (target ?? panel).focus({ preventScroll: true });
  }

  function deactivate() {
    active = false;
    unlockScroll();
    const back = opener;
    opener = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  $: if (typeof document !== 'undefined') {
    if (open && !active) activate();
    else if (!open && active) deactivate();
  }

  onDestroy(() => {
    if (active) deactivate();
  });

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
      return;
    }
    trapTab(e, panel);
  }

  // Focus that escapes (a click on the page behind, a script) is pulled back.
  function onFocusIn(e) {
    if (!open || !panel || panel.contains(e.target)) return;
    const items = focusables(panel);
    (items[0] ?? panel).focus({ preventScroll: true });
  }

  function slide(node, { out = false } = {}) {
    if (reducedMotion()) return { duration: 0 };
    const side = window.matchMedia('(min-width: 768px)').matches;
    return {
      duration: out ? 180 : 220,
      easing: cubicOut,
      css: (t, u) =>
        side
          ? `transform: translateX(calc(${u * 100}% + ${u * 8}px));`
          : `transform: translateY(${u * 100}%);`
    };
  }

  function scrim(node) {
    return reducedMotion() ? { duration: 0 } : fade(node, { duration: 220 });
  }
</script>

<svelte:document on:focusin={onFocusIn} />

{#if open}
  <div class="root" use:portal>
    <!-- Pointer shortcut only; Escape and the close button cover keyboards. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="scrim" transition:scrim on:click={close}></div>
    <div
      bind:this={panel}
      class="panel"
      style="--sheet-width: {width}px;"
      role="dialog"
      aria-modal="true"
      aria-labelledby="{id}-title"
      aria-describedby={description ? `${id}-desc` : undefined}
      tabindex="-1"
      on:keydown={onKeydown}
      in:slide
      out:slide={{ out: true }}
    >
      <header class="head">
        <div class="text">
          <h2 id="{id}-title" class="t-title title">{title}</h2>
          {#if description}<p id="{id}-desc" class="desc">{description}</p>{/if}
        </div>
        <span class="close"><IconButton icon="x" label="Close" size="sm" on:click={close} /></span>
      </header>
      <div class="body"><slot /></div>
      {#if $$slots.footer}<footer class="foot"><slot name="footer" /></footer>{/if}
    </div>
  </div>
{/if}

<style>
  .root {
    position: fixed;
    inset: 0;
    z-index: 100;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background-color: var(--scrim);
  }
  .panel {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 48px);
    color: var(--text-primary);
    background-color: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
    box-shadow: var(--overlay-shadow);
    outline: none;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 16px 16px 20px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .title { margin: 0; }
  .desc {
    margin: 4px 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
  .close {
    display: flex;
    margin-top: -3px;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    padding: 4px 20px 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 20px max(16px, env(safe-area-inset-bottom));
    background-color: var(--surface);
    border-top: 1px solid var(--border);
  }
  .foot > :global(*) { width: 100%; }

  @media (min-width: 768px) {
    .panel {
      top: 8px;
      right: 8px;
      bottom: 8px;
      left: auto;
      width: min(var(--sheet-width), calc(100vw - 16px));
      max-height: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-sheet);
    }
    .head { padding: 24px 20px 16px 24px; }
    .body { padding: 4px 24px 24px; }
    .foot {
      flex-direction: row;
      justify-content: flex-end;
      padding: 16px 24px;
      border-radius: 0 0 var(--radius-sheet) var(--radius-sheet);
    }
    .foot > :global(*) { width: auto; }
  }
</style>
