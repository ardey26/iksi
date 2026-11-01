<script lang="ts">
  // Dashboard "API keys" section body. A new key is shown once, right after it
  // is created, and held only in this component until dismissed. The list
  // shows each key's prefix, never the key.
  import { tick } from 'svelte';
  import { Button, EmptyState, IconButton, Input, List, Paper, Row, Stack, toast } from '#lib/ui/index.js';
  import { API_KEY_NAME_MAX, MAX_API_KEYS, type ApiKeyView } from '#lib/api-keys.js';
  import { relativeDate } from '#lib/format.js';

  export let keys: ApiKeyView[] = [];

  let name = '';
  let busy = false;
  let createError = '';
  let secret = '';
  let copied = false;
  let confirmId: number | null = null;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let root: HTMLElement;

  $: full = keys.length >= MAX_API_KEYS;

  /** Mid-sentence, "Yesterday" reads "yesterday"; a date ("Oct 20") keeps its capital. */
  const inSentence = (s: string) => (/^[A-Z][a-z]{2} \d/.test(s) ? s : s.toLowerCase());

  /** "Created Oct 15, never used" or "Created 2 days ago, last used yesterday". */
  function usage(k: ApiKeyView) {
    const created = `Created ${inSentence(relativeDate(k.createdAt))}`;
    return k.lastUsedAt ? `${created}, last used ${inSentence(relativeDate(k.lastUsedAt))}` : `${created}, never used`;
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
      toast('Could not copy. Select the key and copy it yourself.', { variant: 'error' });
    }
  }

  function done() {
    secret = '';
    copied = false;
  }

  const focus = async (sel: string) => {
    await tick();
    root?.querySelector<HTMLElement>(sel)?.focus();
  };

  // Keyboard focus follows the inline confirm in and back out.
  function ask(k: ApiKeyView) {
    confirmId = k.id;
    focus(`[data-key-cancel="${k.id}"]`);
  }

  function back(k: ApiKeyView) {
    confirmId = null;
    focus(`[data-key-revoke="${k.id}"]`);
  }

  async function revoke(k: ApiKeyView) {
    if (busy) return;
    busy = true;
    const { ok } = await send(`/api/keys?id=${k.id}`, { method: 'DELETE' });
    busy = false;
    confirmId = null;
    if (ok) toast(`${k.name} revoked`, { variant: 'success' });
    else toast('Could not revoke that key.', { variant: 'error' });
  }
</script>

<div bind:this={root}>
  <Stack gap={16}>
    {#if secret}
      <Paper>
        <Stack gap={12}>
          <Input
            label="New key"
            mono
            readonly
            value={secret}
            spellcheck="false"
            autocomplete="off"
            hint="Paste it into the iksi extension's options. You won't see this key again."
            on:focus={(e) => e.currentTarget.select()}
          />
          <Stack direction="row" gap={8} justify="flex-end" wrap>
            <Button variant="ghost" on:click={done}>Done</Button>
            <Button icon={copied ? 'check' : 'copy'} on:click={copy}>{copied ? 'Copied' : 'Copy key'}</Button>
          </Stack>
        </Stack>
      </Paper>
    {/if}

    <Paper padding="none">
      {#if keys.length === 0}
        <EmptyState icon="lock" title="No API keys yet" description="Create one for each browser you use the extension in." />
      {:else}
        <List label="API keys">
          {#each keys as k (k.id)}
            <Row muted={busy && confirmId === k.id}>
              <span class="clip">{k.name}</span>
              <svelte:fragment slot="subtitle">
                {#if confirmId === k.id}
                  <span class="line">Revoke it? Anything using it stops working.</span>
                {:else}
                  <span class="line t-mono">{k.prefix}…</span>
                  <span class="line">{usage(k)}</span>
                {/if}
              </svelte:fragment>
              <svelte:fragment slot="actions">
                {#if confirmId === k.id}
                  <Button size="sm" variant="ghost" data-key-cancel={k.id} disabled={busy} on:click={() => back(k)}>Cancel</Button>
                  <Button size="sm" variant="danger" loading={busy} on:click={() => revoke(k)}>Revoke key</Button>
                {:else}
                  <IconButton icon="trash" variant="danger" label="Revoke {k.name}" data-key-revoke={k.id} disabled={busy} on:click={() => ask(k)} />
                {/if}
              </svelte:fragment>
            </Row>
          {/each}
        </List>
      {/if}
    </Paper>

    {#if full}
      <p class="t-label t-muted">You have {MAX_API_KEYS} keys, the most you can have. Revoke one to create another.</p>
    {:else}
      <form class="create" on:submit|preventDefault={create}>
        <Input
          label="Key name"
          bind:value={name}
          maxlength={API_KEY_NAME_MAX}
          placeholder="Chrome on my laptop"
          autocomplete="off"
          error={createError}
          hint="Name it after where you'll use it. Anyone with a key can shorten links as you."
        />
        <Button type="submit" icon="plus" loading={busy && confirmId === null} disabled={!name.trim()}>Create key</Button>
      </form>
    {/if}
  </Stack>
</div>

<style>
  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .line {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .create {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
  }
  /* The button lines up with the field box, under the label (18px + 8px). */
  .create > :global(button) { margin-top: 26px; }
  @media (max-width: 639px) {
    .create { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .create > :global(button) { margin-top: 0; justify-self: start; }
  }
</style>
