<script lang="ts">
  // Dashboard "Payments" section: the methods behind the profile's Pay button.
  // Every change is saved immediately by /api/pay-methods.
  import {
    MAX_PAY_METHODS,
    PAY_LABEL_TEXT,
    PROVIDER_NAMES,
    qrPlace,
    type PayLabel,
    type PayMethod
  } from '#lib/pay-methods.js';

  export let methods: PayMethod[] = [];
  export let label: PayLabel = 'pay';

  const MAX_BYTES = 4 * 1024 * 1024;
  const LABELS: PayLabel[] = ['pay', 'tip'];

  let mode: 'qr' | 'link' = 'qr';
  let linkUrl = '';
  let busy = false;
  let addError = '';
  let labelError = '';
  let removeError = '';
  let fileInput: HTMLInputElement;

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

  async function add(form: FormData) {
    busy = true;
    addError = '';
    const { ok, body } = await send('/api/pay-methods', { method: 'POST', body: form });
    busy = false;
    if (!ok) addError = body.error || 'Could not add that payment method.';
    return ok;
  }

  async function onPick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file || busy) return;
    if (file.size > MAX_BYTES) {
      addError = 'Images must be under 4 MB.';
      return;
    }
    const form = new FormData();
    form.append('kind', 'qr');
    form.append('file', file);
    await add(form);
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
    removeError = '';
    const { ok, body } = await send(`/api/pay-methods?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' });
    busy = false;
    if (!ok) removeError = body.error || 'Could not remove that payment method.';
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

  const titleOf = (m: PayMethod) => (m.kind === 'qr' ? 'QR code' : PROVIDER_NAMES[m.provider]);
</script>

<div class="d-spec">
  {#each methods as m (m.id)}
    <div class="d-row">
      <span class="d-label">{titleOf(m)}</span>
      <div class="d-control method">
        <div class="min-w-0">
          {#if m.kind === 'qr'}
            <p class="primary">Pays to {m.name}</p>
            <p class="meta">{qrPlace(m)}</p>
            <p class="meta">Pays in {m.currency}</p>
          {:else}
            <p class="primary url">{m.url}</p>
          {/if}
        </div>
        <button type="button" class="d-btn d-btn-text d-btn-danger" disabled={busy}
                aria-label="Remove {titleOf(m)}" on:click={() => remove(m)}>Remove</button>
      </div>
    </div>
  {/each}

  <div class="d-row">
    <span class="d-label" id="pay-add-label">Add a method</span>
    <div class="d-control">
      {#if full}
        <p class="meta limit">You have {MAX_PAY_METHODS} payment methods, the most a profile can have. Remove one to add another.</p>
      {:else}
        <div class="d-seg" role="radiogroup" aria-labelledby="pay-add-label">
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
                {#if busy}<span class="spinner" role="status" aria-label="Reading QR"></span>{/if}
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
      {/if}
      <p class="err" role={addError || removeError ? 'alert' : undefined}>{addError || removeError}</p>
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
      <p class="err" role={labelError ? 'alert' : undefined}>{labelError}</p>
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
  .method .d-btn { margin-top: calc((20px - var(--d-ctl)) / 2); flex: none; }
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
  .add { margin-top: 12px; }
  .add .d-field { flex: 1 1 auto; min-width: 0; }
  .err {
    min-height: 18px;
    margin-top: 8px;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
</style>
