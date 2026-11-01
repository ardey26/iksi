<script lang="ts">
  // Dashboard "API keys" section. A new key is shown once, right after it is
  // created, and held only in this component until dismissed. The list shows
  // each key's prefix, never the key.
  import { API_KEY_NAME_MAX, MAX_API_KEYS, type ApiKeyView } from '#lib/api-keys.js';

  export let keys: ApiKeyView[] = [];

  let name = '';
  let busy = false;
  let createError = '';
  let revokeError = '';
  let secret = '';
  let copied = false;
  let confirmId: number | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  $: full = keys.length >= MAX_API_KEYS;

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function send(url: string, init: RequestInit): Promise<{ ok: boolean; body: any }> {
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.keys)) keys = body.keys;
      return { ok: res.ok, body };
    } catch {
      return { ok: false, body: {} };
    }
  }

  async function create() {
    if (busy || !name.trim()) return;
    busy = true;
    createError = '';
    revokeError = '';
    const { ok, body } = await send('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    busy = false;
    if (!ok || typeof body.secret !== 'string') {
      createError = body.error || 'Could not create a key.';
      return;
    }
    secret = body.secret;
    copied = false;
    name = '';
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 1400);
    } catch {
      createError = 'Could not copy. Select the key and copy it yourself.';
    }
  }

  function done() {
    secret = '';
    copied = false;
  }

  async function revoke(k: ApiKeyView) {
    if (busy) return;
    busy = true;
    revokeError = '';
    const { ok } = await send(`/api/keys?id=${k.id}`, { method: 'DELETE' });
    busy = false;
    confirmId = null;
    if (!ok) revokeError = 'Could not revoke that key.';
  }
</script>

<div class="d-spec">
  {#if secret}
    <div class="d-row">
      <label class="d-label" for="api-key-secret">New key</label>
      <div class="d-control">
        <div class="d-inline flex-nowrap">
          <input id="api-key-secret" class="d-field mono" readonly value={secret}
                 spellcheck="false" autocomplete="off" on:focus={(e) => e.currentTarget.select()} />
          <button type="button" class="d-btn d-btn-secondary shrink-0 copy" on:click={copy}>{copied ? 'Copied' : 'Copy key'}</button>
        </div>
        <p class="d-hint">Paste it into the iksi extension's options. You won't see this key again.</p>
        <button type="button" class="d-btn d-btn-text done" on:click={done}>Done</button>
      </div>
    </div>
  {/if}

  {#each keys as k (k.id)}
    <div class="d-row">
      <span class="d-label name">{k.name}</span>
      <div class="d-control key">
        <div class="min-w-0">
          <p class="primary mono">{k.prefix}…</p>
          <p class="meta">Created {fmt(k.createdAt)} · {k.lastUsedAt ? `Last used ${fmt(k.lastUsedAt)}` : 'Never used'}</p>
        </div>
        <div class="actions">
          {#if confirmId === k.id}
            <button type="button" class="d-btn d-btn-text d-btn-danger" disabled={busy} on:click={() => revoke(k)}>Revoke key</button>
            <button type="button" class="d-btn d-btn-text" disabled={busy} on:click={() => (confirmId = null)}>Cancel</button>
          {:else}
            <button type="button" class="d-btn d-btn-text d-btn-danger" disabled={busy}
                    aria-label="Revoke {k.name}" on:click={() => (confirmId = k.id)}>Revoke</button>
          {/if}
        </div>
      </div>
    </div>
  {/each}

  <div class="d-row">
    {#if full}
      <span class="d-label">Create a key</span>
    {:else}
      <label class="d-label" for="api-key-name">Create a key</label>
    {/if}
    <div class="d-control">
      {#if full}
        <p class="meta limit">You have {MAX_API_KEYS} keys, the most you can have. Revoke one to create another.</p>
      {:else}
        <form class="d-inline flex-nowrap" on:submit|preventDefault={create}>
          <input id="api-key-name" class="d-field" bind:value={name} maxlength={API_KEY_NAME_MAX}
                 placeholder="Chrome on my laptop" autocomplete="off" />
          <button type="submit" class="d-btn d-btn-secondary shrink-0" disabled={busy || !name.trim()}>Create key</button>
        </form>
        <p class="d-hint">Name it after where you'll use it. Anyone with a key can shorten links as you, so revoke keys you no longer use.</p>
      {/if}
      <p class="err" role={createError || revokeError ? 'alert' : undefined}>{createError || revokeError}</p>
    </div>
  </div>
</div>

<style>
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
  }
  .d-field.mono { flex: 1 1 auto; min-width: 0; }
  form .d-field { flex: 1 1 auto; min-width: 0; }
  .copy { min-width: 96px; }
  .done { margin-top: 4px; padding-left: 0; padding-right: 0; }
  .name { overflow-wrap: anywhere; }
  .key {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    min-height: var(--d-ctl);
    padding-top: calc((var(--d-ctl) - 20px) / 2);
  }
  .actions {
    display: flex;
    flex: none;
    gap: 12px;
    margin-top: calc((20px - var(--d-ctl)) / 2);
  }
  .primary {
    line-height: 20px;
    color: var(--text-primary);
  }
  .meta {
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .limit { padding-top: calc((var(--d-ctl) - 18px) / 2); }
  .err {
    min-height: 18px;
    margin-top: 8px;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
</style>
