<script lang="ts">
  // Dashboard "Payments" section: the methods behind the profile's Pay button.
  // Every change is saved immediately by /api/pay-methods.
  import { tick } from 'svelte';
  import PayLogo from './PayLogo.svelte';
  import {
    MAX_PAY_METHODS,
    PAY_LABEL_TEXT,
    QR_PROVIDERS,
    QR_PROVIDER_INFO,
    methodTitle,
    qrPlace,
    type PayLabel,
    type PayMethod,
    type QrProvider
  } from '#lib/pay-methods.js';

  export let methods: PayMethod[] = [];
  export let label: PayLabel = 'pay';

  const MAX_BYTES = 4 * 1024 * 1024;
  const LABELS: PayLabel[] = ['pay', 'tip'];

  // What "Add a method" shows: a wallet's upload, the generic flow, or nothing.
  let pick: QrProvider | 'other' | null = null;
  let mode: 'qr' | 'link' = 'qr';
  let linkUrl = '';
  let busy = false;
  let error = '';
  let notice = '';
  let labelError = '';
  let fileInput: HTMLInputElement;
  let listEl: HTMLElement;
  // The last wallet tapped, so its hint stays in place while the panel closes.
  let wallet: QrProvider = 'gcash';

  $: full = methods.length >= MAX_PAY_METHODS;
  $: if (pick && pick !== 'other') wallet = pick;

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
    notice = '';
  }

  async function add(form: FormData) {
    busy = true;
    clearMessages();
    const { ok, body } = await send('/api/pay-methods', { method: 'POST', body: form });
    busy = false;
    if (!ok) error = body.error || 'Could not add that payment method.';
    else notice = body.notice || '';
    return ok;
  }

  function choose(next: QrProvider | 'other') {
    pick = pick === next ? null : next;
    clearMessages();
  }

  async function onPick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file || busy) return;
    if (file.size > MAX_BYTES) {
      clearMessages();
      error = 'Images must be under 4 MB.';
      return;
    }
    const form = new FormData();
    form.append('kind', 'qr');
    form.append('file', file);
    const tapped = pick !== 'other' ? pick : null;
    if (tapped) form.append('provider', tapped);
    // A wallet upload closes its panel once saved; the generic flow stays open for more.
    if ((await add(form)) && tapped) {
      pick = null;
      await tick();
      listEl?.querySelector<HTMLButtonElement>(`[data-wallet="${tapped}"]`)?.focus();
    }
  }

  async function addLink() {
    if (busy || !linkUrl.trim()) return;
    const form = new FormData();
    form.append('kind', 'link');
    form.append('url', linkUrl);
    if (await add(form)) linkUrl = '';
  }

  async function remove(m: PayMethod) {
    if (busy) return;
    busy = true;
    clearMessages();
    const { ok, body } = await send(`/api/pay-methods?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' });
    busy = false;
    if (!ok) error = body.error || 'Could not remove that payment method.';
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
        <div class="who">
          {#if m.kind === 'qr' && m.provider}
            <PayLogo provider={m.provider} size={32} />
          {/if}
          <div class="min-w-0">
            {#if m.kind === 'qr'}
              <p class="primary">Pays to {m.name}</p>
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
          <button type="button" class="d-btn d-btn-text d-btn-danger" disabled={busy}
                  aria-label="Remove {methodTitle(m)}" on:click={() => remove(m)}>Remove</button>
        </div>
      </div>
    </div>
  {/each}

  <div class="d-row">
    <span class="d-label" id="pay-add-label">Add a method</span>
    <div class="d-control">
      {#if full}
        <p class="meta limit">You have {MAX_PAY_METHODS} payment methods, the most a profile can have. Remove one to add another.</p>
      {:else}
        <div class="tiles" role="group" aria-labelledby="pay-add-label">
          {#each QR_PROVIDERS as p}
            {@const info = QR_PROVIDER_INFO[p]}
            <button type="button" class="tile" aria-label="Add {info.name} QR" aria-pressed={pick === p}
                    aria-controls="pay-wallet" data-wallet={p} on:click={() => choose(p)}>
              <PayLogo provider={p} size={36} alt="" />
              {#if !info.wordmark}<span class="tile-name" aria-hidden="true">{info.name}</span>{/if}
            </button>
          {/each}
        </div>

        <!-- Progressive disclosure: the panels animate their height open, so nothing below jumps. -->
        <div id="pay-wallet" class="reveal" class:open={pick !== null && pick !== 'other'}
             aria-hidden={pick === null || pick === 'other'} inert={pick === null || pick === 'other'}>
          <div>
            <div class="panel">
              <div class="d-inline">
                <button type="button" class="d-btn d-btn-secondary" disabled={busy} on:click={() => fileInput.click()}>Choose image</button>
                <span class="w-4 h-4 shrink-0 flex items-center justify-center" aria-live="polite">
                  {#if busy && pick !== 'other'}<span class="spinner" role="status" aria-label="Reading QR"></span>{/if}
                </span>
              </div>
              <p class="d-hint">Open {QR_PROVIDER_INFO[wallet].name} and save your receive-money QR. The image is read, then discarded.</p>
            </div>
          </div>
        </div>

        <button type="button" class="d-btn d-btn-text more" aria-expanded={pick === 'other'} aria-controls="pay-other"
                on:click={() => choose('other')}>Other bank or payment link</button>

        <div id="pay-other" class="reveal" class:open={pick === 'other'}
             aria-hidden={pick !== 'other'} inert={pick !== 'other'}>
          <div>
            <div class="panel">
              <div class="d-seg" role="radiogroup" aria-label="How to add">
                <label class="d-key">
                  <input type="radio" class="sr-only" name="pay-add-mode" value="qr" bind:group={mode} />
                  <span>Upload a QR image</span>
                </label>
                <label class="d-key">
                  <input type="radio" class="sr-only" name="pay-add-mode" value="link" bind:group={mode} />
                  <span>Paste a link</span>
                </label>
              </div>

              <div class="add">
                {#if mode === 'qr'}
                  <div class="d-inline">
                    <button type="button" class="d-btn d-btn-secondary" disabled={busy} on:click={() => fileInput.click()}>Choose image</button>
                    <span class="w-4 h-4 shrink-0 flex items-center justify-center" aria-live="polite">
                      {#if busy && pick === 'other'}<span class="spinner" role="status" aria-label="Reading QR"></span>{/if}
                    </span>
                  </div>
                  <p class="d-hint">A screenshot of the payment QR from your bank or e-wallet app, or a PayPal, Venmo or Cash App QR. The image is read, then discarded.</p>
                {:else}
                  <form class="d-inline flex-nowrap" on:submit|preventDefault={addLink}>
                    <input type="url" class="d-field" bind:value={linkUrl} aria-label="Payment link"
                           placeholder="https://paypal.me/you" autocomplete="off" spellcheck="false" />
                    <button type="submit" class="d-btn d-btn-secondary shrink-0" disabled={busy || !linkUrl.trim()}>Add link</button>
                  </form>
                  <p class="d-hint">PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.</p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
      <p class="msg" class:err={!!error} role={error ? 'alert' : notice ? 'status' : undefined}>{error || notice}</p>
      <input bind:this={fileInput} type="file" class="hidden" on:change={onPick}
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
  .who :global(.pay-logo) { margin-top: -6px; }
  .actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-top: calc((20px - var(--d-ctl)) / 2);
  }
  .actions .d-btn { margin-left: 8px; }
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

  /* Wallet tiles: three equal keys, each a logo on its white chip. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
    height: 88px;
    padding: 0 8px;
    font: inherit;
    color: var(--text-muted);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--d-radius);
    cursor: pointer;
    transition: border-color var(--duration-normal) var(--ease-out), color var(--duration-normal) var(--ease-out);
  }
  .tile:hover { border-color: var(--text-muted); color: var(--text-primary); }
  .tile[aria-pressed='true'] { border-color: var(--accent); color: var(--text-primary); }
  .tile:focus-visible {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }
  .tile-name {
    max-width: 100%;
    overflow: hidden;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .more { margin-top: 8px; }

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
  .add { margin-top: 12px; }
  .add .d-field { flex: 1 1 auto; min-width: 0; }
  .msg {
    min-height: 18px;
    margin-top: 8px;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .msg.err { color: var(--error); }

  @media (max-width: 639px) {
    .method { flex-direction: column; gap: 8px; }
    .actions { margin-top: 0; margin-left: -6px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal,
    .tile { transition: none; }
  }
</style>
