<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let kind: 'avatar' | 'background';
  export let value: string | null = null;
  // The image currently stored on the server for this kind. Remove only calls
  // the server when the shown value is that image; any other value is an
  // unsaved local one (e.g. a typed URL) and is cleared locally.
  // undefined means "value is always the stored image".
  export let savedUrl: string | null | undefined = undefined;

  const MAX_BYTES = 4 * 1024 * 1024;
  const dispatch = createEventDispatcher<{ change: { url: string | null; persisted: boolean } }>();

  let input: HTMLInputElement;
  let busy = false;
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
    busy = true;
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
      busy = false;
    }
  }
</script>

<div class="upload">
  <div class="flex items-center gap-4">
    <div class="frame" class:avatar={isAvatar}>
      {#if value}
        <img src={value} alt="" class="w-full h-full object-cover" />
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
      <button type="button" on:click={() => input.click()} disabled={busy} class="d-btn d-btn-text primary">Upload</button>
      {#if value}
        <button type="button" on:click={remove} disabled={busy} class="d-btn d-btn-text d-btn-danger">Remove</button>
      {/if}
      <slot />
      <span class="w-4 h-4 shrink-0 flex items-center justify-center" aria-live="polite">
        {#if busy}<span class="spinner" role="status" aria-label="Uploading"></span>{/if}
      </span>
    </div>
  </div>
  <p class="err" role={error ? 'alert' : undefined}>{error}</p>
  <input bind:this={input} type="file" class="hidden" on:change={onPick}
         accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
</div>

<style>
  .frame {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 160px;
    height: 90px;
    overflow: hidden;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .frame.avatar {
    width: 64px;
    height: 64px;
    border-radius: 12px;
  }
  .primary {
    color: var(--text-primary);
  }
  .err {
    min-height: 18px;
    margin-top: 8px;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
</style>
