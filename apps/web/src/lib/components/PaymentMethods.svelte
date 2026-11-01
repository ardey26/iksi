<script lang="ts">
  // Dashboard "Payments" section: the methods behind the profile's Pay button.
  // Every change is saved immediately by /api/pay-methods. Banks are never
  // listed here: each QR names its own (#lib/pay-institutions).
  import { tick } from 'svelte';
  import PayMark from './PayMark.svelte';
  import { defaultQrLabel, institutionById } from '#lib/pay-institutions.js';
  import {
    MAX_METHOD_LABEL_LENGTH,
    MAX_PAY_METHODS,
    PAY_LABEL_TEXT,
    methodTitle,
    qrPlace,
    titleCase,
    type PayLabel,
    type PayMethod,
    type QrMethod
  } from '#lib/pay-methods.js';

  export let methods: PayMethod[] = [];
  export let label: PayLabel = 'pay';

  const MAX_BYTES = 4 * 1024 * 1024;
  const LABELS: PayLabel[] = ['pay', 'tip'];

  /** What happened to one picked image, or to a pasted link. */
  type Result = { file: string; ok: boolean; text: string };

  let results: Result[] = [];
  let error = '';
  let labelError = '';
  let busy = false;
  let linkOpen = false;
  let linkUrl = '';
  // The QR being renamed, and the name being typed.
  let editing: string | null = null;
  let draft = '';
  let renameError = '';
  let fileInput: HTMLInputElement;
  let listEl: HTMLElement;

  $: full = methods.length >= MAX_PAY_METHODS;

  async function send(url: string, init: RequestInit): Promise<{ ok: boolean; body: any }> {
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.methods)) methods = body.methods;
      return { ok: res.ok, body };
    } catch {
      return { ok: false, body: {} };
    }
  }

  function clearMessages() {
    error = '';
    results = [];
  }

  /** "Added GCash": the name the server gave the method it added. */
  function addedText(body: any): string {
    const m = methods.find((x) => x.id === body.added);
    return m ? `Added ${methodTitle(m)}` : 'Added';
  }

  async function uploadOne(file: File): Promise<Result> {
    const r = (ok: boolean, text: string) => ({ file: file.name, ok, text });
    if (methods.length >= MAX_PAY_METHODS) return r(false, `Not added. You can have up to ${MAX_PAY_METHODS} payment methods.`);
    if (file.size > MAX_BYTES) return r(false, 'Images must be under 4 MB.');
    const form = new FormData();
    form.append('kind', 'qr');
    form.append('file', file);
    const { ok, body } = await send('/api/pay-methods', { method: 'POST', body: form });
    return ok ? r(true, addedText(body)) : r(false, body.error || 'Could not add that image.');
  }

  // One request per image, in order: each is saved before the next is read, and
  // a request body stays under the host's size limit.
  async function onPick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const files = [...(target.files ?? [])];
    target.value = '';
    if (files.length === 0 || busy) return;
    busy = true;
    clearMessages();
    for (const file of files) results = [...results, await uploadOne(file)];
    busy = false;
  }

  async function addLink() {
    if (busy || !linkUrl.trim()) return;
    busy = true;
    clearMessages();
    const form = new FormData();
    form.append('kind', 'link');
    form.append('url', linkUrl);
    const { ok, body } = await send('/api/pay-methods', { method: 'POST', body: form });
    busy = false;
    if (!ok) {
      error = body.error || 'Could not add that link.';
      return;
    }
    results = [{ file: '', ok: true, text: addedText(body) }];
    linkUrl = '';
  }

  async function remove(m: PayMethod) {
    if (busy) return;
    busy = true;
    clearMessages();
    const { ok, body } = await send(`/api/pay-methods?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' });
    busy = false;
    if (!ok) error = body.error || 'Could not remove that payment method.';
  }

  const focusRename = async (id: string) => {
    await tick();
    listEl?.querySelector<HTMLButtonElement>(`[data-rename="${id}"]`)?.focus();
  };

  function startRename(m: QrMethod) {
    editing = m.id;
    draft = m.label;
    renameError = '';
  }

  function cancelRename(id: string) {
    editing = null;
    renameError = '';
    focusRename(id);
  }

  async function saveRename(m: QrMethod) {
    if (busy) return;
    busy = true;
    renameError = '';
    const { ok, body } = await send('/api/pay-methods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rename: { id: m.id, label: draft } })
    });
    busy = false;
    if (!ok) {
      renameError = body.error || 'Could not save the name.';
      return;
    }
    cancelRename(m.id);
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  // Order sets which method the Pay sheet opens on. Moves show at once and are put back if saving fails.
  async function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (busy || j < 0 || j >= methods.length) return;
    const prev = methods;
    const next = [...methods];
    [next[i], next[j]] = [next[j], next[i]];
    const id = next[j].id;
    methods = next;
    busy = true;
    clearMessages();
    const { ok, body } = await send('/api/pay-methods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((m) => m.id) })
    });
    busy = false;
    if (!ok) {
      methods = prev;
      error = body.error || 'Could not save the order.';
      return;
    }
    // Keep focus on the moved method, on the button that can still move it.
    await tick();
    const btn = (dir: string) => listEl?.querySelector<HTMLButtonElement>(`[data-move="${id}:${dir}"]`);
    const same = btn(by < 0 ? 'up' : 'down');
    (same && !same.disabled ? same : btn(by < 0 ? 'down' : 'up'))?.focus();
  }

  async function setLabel(next: PayLabel) {
    const prev = label;
    if (next === prev) return;
    label = next;
    labelError = '';
    const { ok } = await send('/api/pay-methods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: next })
    });
    if (!ok) {
      label = prev;
      labelError = 'Could not save the label.';
    }
  }
</script>

<div class="d-spec" bind:this={listEl}>
  {#each methods as m, i (m.id)}
    <div class="d-row">
      <span class="d-label">{methodTitle(m)}</span>
      <div class="d-control method">
        {#if m.kind === 'qr' && editing === m.id}
          <div class="rename">
            <form class="d-inline flex-nowrap" on:submit|preventDefault={() => saveRename(m)}>
              <input type="text" class="d-field" bind:value={draft} maxlength={MAX_METHOD_LABEL_LENGTH}
                     aria-label="Name for {m.label}" autocomplete="off" use:focusOnMount
                     on:keydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelRename(m.id); } }} />
              <button type="submit" class="d-btn d-btn-secondary shrink-0" disabled={busy}>Save</button>
              <button type="button" class="d-btn d-btn-text shrink-0" on:click={() => cancelRename(m.id)}>Cancel</button>
            </form>
            {#if renameError}
              <p class="msg err" role="alert">{renameError}</p>
            {:else}
              <p class="d-hint">Up to {MAX_METHOD_LABEL_LENGTH} characters. Leave empty to use {defaultQrLabel(institutionById(m.institution))}.</p>
            {/if}
          </div>
        {:else}
          <div class="who">
            <PayMark institution={m.kind === 'qr' ? m.institution : null} label={methodTitle(m)} size={32} alt="" />
            <div class="min-w-0">
              {#if m.kind === 'qr'}
                <p class="primary">Pays to {titleCase(m.name)}</p>
                <p class="meta">{qrPlace(m)}</p>
                <p class="meta">Pays in {m.currency}</p>
              {:else}
                <p class="primary url">{m.url}</p>
              {/if}
            </div>
          </div>
          <div class="actions">
            {#if methods.length > 1}
              <button type="button" class="d-icon" disabled={busy || i === 0} data-move="{m.id}:up"
                      aria-label="Move {methodTitle(m)} up" on:click={() => move(i, -1)}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>
              </button>
              <button type="button" class="d-icon" disabled={busy || i === methods.length - 1} data-move="{m.id}:down"
                      aria-label="Move {methodTitle(m)} down" on:click={() => move(i, 1)}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
              </button>
            {/if}
            {#if m.kind === 'qr'}
              <button type="button" class="d-btn d-btn-text" disabled={busy} data-rename={m.id}
                      aria-label="Rename {m.label}" on:click={() => startRename(m)}>Rename</button>
            {/if}
            <button type="button" class="d-btn d-btn-text d-btn-danger" disabled={busy}
                    aria-label="Remove {methodTitle(m)}" on:click={() => remove(m)}>Remove</button>
          </div>
        {/if}
      </div>
    </div>
  {/each}

  <div class="d-row">
    <span class="d-label">Add a method</span>
    <div class="d-control">
      {#if full}
        <p class="meta limit">You have {MAX_PAY_METHODS} payment methods, the most a profile can have. Remove one to add another.</p>
      {:else}
        <div class="d-inline">
          <button type="button" class="d-btn d-btn-primary" disabled={busy} on:click={() => fileInput.click()}>Add payment QR</button>
          <button type="button" class="d-btn d-btn-secondary" aria-expanded={linkOpen} aria-controls="pay-link"
                  on:click={() => (linkOpen = !linkOpen)}>Add payment link</button>
          <span class="w-4 h-4 shrink-0 flex items-center justify-center">
            {#if busy}<span class="spinner" role="progressbar" aria-label="Saving"></span>{/if}
          </span>
        </div>
        <p class="d-hint">Pick one or more screenshots of the payment QR in your bank or e-wallet app. Each image is read, then discarded.</p>

        <!-- Progressive disclosure: the panel animates its height open, so nothing below jumps. -->
        <div id="pay-link" class="reveal" class:open={linkOpen} aria-hidden={!linkOpen} inert={!linkOpen}>
          <div>
            <div class="panel">
              <form class="d-inline flex-nowrap" on:submit|preventDefault={addLink}>
                <input type="url" class="d-field" bind:value={linkUrl} aria-label="Payment link"
                       placeholder="https://paypal.me/you" autocomplete="off" spellcheck="false" />
                <button type="submit" class="d-btn d-btn-secondary shrink-0" disabled={busy || !linkUrl.trim()}>Add link</button>
              </form>
              <p class="d-hint">PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.</p>
            </div>
          </div>
        </div>
      {/if}
      <div class="msg" role="status">
        {#if error}
          <p class="err" role="alert">{error}</p>
        {:else if results.length === 1}
          <p class:err={!results[0].ok} role={results[0].ok ? undefined : 'alert'}>{results[0].text}</p>
        {:else if results.length > 1}
          <ul aria-label="Upload results">
            {#each results as r}<li class:err={!r.ok}>{r.file}: {r.text}</li>{/each}
          </ul>
        {/if}
      </div>
      <input bind:this={fileInput} type="file" class="hidden" multiple on:change={onPick}
             accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
    </div>
  </div>

  <div class="d-row">
    <span class="d-label" id="pay-label-label">Button label</span>
    <div class="d-control">
      <div class="d-seg" role="radiogroup" aria-labelledby="pay-label-label">
        {#each LABELS as l}
          <label class="d-key">
            <input type="radio" class="sr-only" name="pay-label" value={l} checked={label === l}
                   on:change={() => setLabel(l)} />
            <span>{PAY_LABEL_TEXT[l]}</span>
          </label>
        {/each}
      </div>
      <p class="msg err" role={labelError ? 'alert' : undefined}>{labelError}</p>
    </div>
  </div>
</div>

<style>
  .method {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    min-height: var(--d-ctl);
    padding-top: calc((var(--d-ctl) - 20px) / 2);
  }
  .who {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }
  .who :global(.pay-mark) { margin-top: -6px; }
  .actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-top: calc((20px - var(--d-ctl)) / 2);
  }
  .actions .d-btn { margin-left: 8px; }
  .rename {
    flex: 1 1 auto;
    min-width: 0;
    margin-top: calc((20px - var(--d-ctl)) / 2);
  }
  .rename .d-field { flex: 1 1 auto; min-width: 0; }
  .primary {
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }
  .url {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    font-weight: 400;
  }
  .meta {
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .limit { padding-top: calc((var(--d-ctl) - 18px) / 2); }

  /* Height animates from 0 to the content's own (DESIGN.md, progressive disclosure). */
  .reveal {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    visibility: hidden;
    transition: grid-template-rows var(--duration-slow) var(--ease-out), opacity var(--duration-slow) var(--ease-out), visibility 0s linear var(--duration-slow);
  }
  .reveal.open {
    grid-template-rows: 1fr;
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }
  .reveal > div { min-height: 0; overflow: hidden; }
  /* Room for the focus rings inside the clipped panel. */
  .panel { padding: 12px 3px 3px; }
  .panel .d-field { flex: 1 1 auto; min-width: 0; }
  .msg {
    min-height: 18px;
    margin-top: 8px;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .msg .err,
  .msg.err { color: var(--error); }

  @media (max-width: 639px) {
    .method { flex-direction: column; gap: 8px; }
    .actions { margin-top: 0; margin-left: -6px; }
    .rename { margin-top: 0; width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal { transition: none; }
  }
</style>
