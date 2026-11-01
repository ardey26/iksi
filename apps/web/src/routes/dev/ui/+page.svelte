<script>
  // Dev-only gallery of the UI kit (+page.server.ts 404s outside `vite dev`).
  import { onMount } from 'svelte';
  import { theme } from '#lib/stores/theme.js';
  import { Container, Segmented, Toast } from '#lib/ui/index.js';
  import Gallery from './Gallery.svelte';

  let split = false;
  $: mode = split ? 'split' : $theme;

  // ?theme=dark|light|split, for screenshots and links.
  onMount(() => {
    const t = new URLSearchParams(location.search).get('theme');
    if (t === 'split') split = true;
    else if ((t === 'dark' || t === 'light') && t !== $theme) theme.set(t);
  });

  function pick(e) {
    const v = e.detail.value;
    split = v === 'split';
    if (!split && v !== $theme) theme.set(v);
  }
</script>

<svelte:head>
  <title>UI kit | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="bar">
  <Segmented
    size="sm"
    label="Theme"
    value={mode}
    on:change={pick}
    options={[
      { value: 'dark', label: 'Dark', icon: 'moon' },
      { value: 'light', label: 'Light', icon: 'sun' },
      { value: 'split', label: 'Side by side' }
    ]}
  />
</div>

{#if split}
  <div class="split">
    <div class="pane" data-theme="dark"><Gallery /></div>
    <div class="pane" data-theme="light"><Gallery /></div>
  </div>
{:else}
  <Container width="wide"><Gallery /></Container>
{/if}

<Toast />

<style>
  .bar {
    position: sticky;
    top: 16px;
    z-index: 40;
    display: flex;
    justify-content: center;
    margin-bottom: 48px;
    pointer-events: none;
  }
  .bar > :global(*) {
    pointer-events: auto;
    box-shadow: 0 0 0 1px var(--border), 0 8px 24px rgb(0 0 0 / 0.24);
  }
  .split {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 560px), 1fr));
    gap: 16px;
    margin: 0 -8px;
  }
  .pane {
    min-width: 0;
    padding: 48px var(--gutter);
    color: var(--text-primary);
    background-color: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sheet);
  }
</style>
