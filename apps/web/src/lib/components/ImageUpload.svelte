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

<div class="space-y-2">
  <div class="flex items-center gap-4">
    <div class="shrink-0 overflow-hidden flex items-center justify-center {isAvatar ? 'w-16 h-16 rounded-full' : 'w-40 h-[90px] rounded-lg'}"
         style="background: var(--bg); border: 1px solid var(--border);">
      {#if value}
        <img src={value} alt="" class="w-full h-full object-cover" />
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <button type="button" on:click={() => input.click()} disabled={busy}
              class="px-3 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style="background: var(--bg); border: 1px solid var(--border); color: var(--text-primary); cursor: pointer;">
        Upload
      </button>
      {#if value}
        <button type="button" on:click={remove} disabled={busy}
                class="text-sm transition-opacity hover:opacity-70 disabled:opacity-30 disabled:cursor-not-allowed"
                style="background: none; border: none; color: var(--text-muted); cursor: pointer;">
          Remove
        </button>
      {/if}
      <span class="w-4 h-4 shrink-0 flex items-center justify-center" aria-live="polite">
        {#if busy}<span class="spinner" role="status" aria-label="Uploading"></span>{/if}
      </span>
    </div>
  </div>
  <p class="text-sm min-h-5" style="color: var(--error);" role={error ? 'alert' : undefined}>{error}</p>
  <input bind:this={input} type="file" class="hidden" on:change={onPick}
         accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
</div>
