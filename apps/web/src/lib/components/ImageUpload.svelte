<script lang="ts">
  // An image field for the profile editor: a preview, Upload and Remove.
  // Uploads are stored by /api/media straight away.
  import { createEventDispatcher } from 'svelte';
  import { Button } from '#lib/ui/index.js';

  export let kind: 'avatar' | 'background';
  export let value: string | null = null;
  // The image currently stored on the server for this kind. Remove only calls
  // the server when the shown value is that image; any other value is an
  // unsaved local one (e.g. a typed URL) and is cleared locally.
  // undefined means "value is always the stored image".
  export let savedUrl: string | null | undefined = undefined;
  /** Accessible name for the Upload button's target, e.g. "avatar". */
  export let name = kind;

  const MAX_BYTES = 4 * 1024 * 1024;
  const dispatch = createEventDispatcher<{ change: { url: string | null; persisted: boolean } }>();

  let input: HTMLInputElement;
  let busy = false;
  let removing = false;
  let error = '';

  $: isAvatar = kind === 'avatar';

  async function onPick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    error = '';
    if (file.size > MAX_BYTES) {
      error = 'Images must be under 4 MB.';
      return;
    }
    busy = true;
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      const res = await fetch('/api/media', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = data.error || 'Upload failed.';
        return;
      }
      value = data.url;
      dispatch('change', { url: data.url, persisted: true });
    } catch {
      error = 'Upload failed.';
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (busy) return;
    error = '';
    if (savedUrl !== undefined && value !== savedUrl) {
      value = null;
      dispatch('change', { url: null, persisted: false });
      return;
    }
    busy = removing = true;
    try {
      const res = await fetch(`/api/media?kind=${kind}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error = data.error || 'Could not remove image.';
        return;
      }
      value = null;
      dispatch('change', { url: null, persisted: true });
    } catch {
      error = 'Could not remove image.';
    } finally {
      busy = removing = false;
    }
  }
</script>

<div class="upload">
  <div class="body">
    <div class="frame" class:avatar={isAvatar} class:empty={!value} aria-busy={busy || undefined}>
      {#if value}<img src={value} alt="" />{/if}
    </div>
    <div class="actions">
      <Button size="sm" icon="plus" loading={busy && !removing} disabled={busy} aria-label="Upload {name}" on:click={() => input.click()}>Upload</Button>
      {#if value}
        <Button size="sm" variant="danger" loading={removing} disabled={busy} on:click={remove}>Remove</Button>
      {/if}
      <slot />
    </div>
  </div>
  <p class="err t-caption" role={error ? 'alert' : undefined}>{error}</p>
  <input bind:this={input} type="file" class="hidden" on:change={onPick}
         accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
</div>

<style>
  .body {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .frame {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 160px;
    height: 90px;
    overflow: hidden;
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
  .frame.empty { border-style: dashed; }
  .frame.avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }
  .frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  /* Keeps its line, so an error never moves the layout. */
  .err {
    min-height: 16px;
    margin: 6px 0 0;
    color: var(--error);
  }
  @media (max-width: 639px) {
    .frame:not(.avatar) { width: 112px; height: 63px; }
  }
</style>
