<script lang="ts">
  // Dashboard "Payments" section: the methods behind the profile's Pay button.
  // Every change is saved immediately by /api/pay-methods. Banks are never
  // listed here: each QR names its own (#lib/pay-institutions).
  import { tick } from 'svelte';
  import {
    Button,
    DragHandle,
    EmptyState,
    Icon,
    IconButton,
    Input,
    Logo,
    Monogram,
    Paper,
    Row,
    Section,
    Segmented,
    SortableList,
    Stack
  } from '#lib/ui/index.js';
  import { defaultQrLabel, institutionById, logoSpellsName } from '#lib/pay-institutions.js';
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
  import { displayUrl } from '#lib/format.js';

  export let methods: PayMethod[] = [];
  export let label: PayLabel = 'pay';

  const MAX_BYTES = 4 * 1024 * 1024;
  const LABELS = (['pay', 'tip'] as PayLabel[]).map((value) => ({ value, label: PAY_LABEL_TEXT[value] }));

  /** What happened to one picked image, or to a pasted link. */
  type Result = { file: string; ok: boolean; text: string };

  let results: Result[] = [];
  let error = '';
  let labelError = '';
  let busy = false;
  let uploading = false;
  let linkOpen = false;
  let linkUrl = '';
  let linkError = '';
  // The QR being renamed, and the name being typed.
  let editing: string | null = null;
  let draft = '';
  let renameError = '';
  let confirming: string | null = null;
  let fileInput: HTMLInputElement;
  let root: HTMLElement;

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
    linkError = '';
    results = [];
  }

  const focus = async (sel: string) => {
    await tick();
    root?.querySelector<HTMLElement>(sel)?.focus();
  };

  /** "Added GCash": the name the server gave the method it added. */
  function addedText(body: any): string {
    const m = methods.find((x) => x.id === body.added);
    return m ? `Added ${methodTitle(m)}` : 'Added';
  }

  function logoOf(m: PayMethod) {
    const info = m.kind === 'qr' ? institutionById(m.institution) : null;
    return info?.logo ? info : null;
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
    busy = uploading = true;
    clearMessages();
    for (const file of files) results = [...results, await uploadOne(file)];
    busy = uploading = false;
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
      linkError = body.error || 'Could not add that link.';
      return;
    }
    results = [{ file: '', ok: true, text: addedText(body) }];
    linkUrl = '';
  }

  // Removing confirms inline; keyboard focus follows the confirm in and out.
  function ask(m: PayMethod) {
    confirming = m.id;
    focus(`[data-pay-cancel="${m.id}"]`);
  }
  function keep(m: PayMethod) {
    confirming = null;
    focus(`[data-pay-remove="${m.id}"]`);
  }

  async function remove(m: PayMethod) {
    if (busy) return;
    busy = true;
    clearMessages();
    const { ok, body } = await send(`/api/pay-methods?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' });
    busy = false;
    confirming = null;
    if (!ok) error = body.error || 'Could not remove that payment method.';
  }

  function startRename(m: QrMethod) {
    editing = m.id;
    draft = m.label;
    renameError = '';
    focus(`[data-rename-field="${m.id}"]`);
  }

  function cancelRename(id: string) {
    editing = null;
    renameError = '';
    focus(`[data-rename="${id}"]`);
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

  // Order sets which method the Pay sheet opens on. SortableList has already
  // moved the row; the order is saved, and put back if saving fails.
  async function saveOrder(e: CustomEvent<{ ids: string[] }>) {
    const prev = methods;
    const byId = new Map(methods.map((m) => [m.id, m]));
    methods = e.detail.ids.map((id) => byId.get(id)!).filter(Boolean);
    busy = true;
    clearMessages();
    const { ok, body } = await send('/api/pay-methods', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: methods.map((m) => m.id) })
    });
    busy = false;
    if (!ok) {
      methods = prev;
      error = body.error || 'Could not save the order.';
    }
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

  function toggleLink() {
    linkOpen = !linkOpen;
    if (linkOpen) focus('[data-act="pay-link"]');
  }
</script>

<Section title="Payments" description="A Pay button on your public page. People pick a method and pay you directly. Changes save right away.">
  <svelte:fragment slot="actions">
    <Segmented label="Button label" options={LABELS} value={label} on:change={(e) => setLabel(e.detail.value)} />
  </svelte:fragment>

  <div class="payments" bind:this={root}>
    <Stack gap={16}>
      {#if labelError}<p class="t-label err" role="alert">{labelError}</p>{/if}

      <Paper padding="none">
        {#if methods.length === 0}
          <EmptyState icon="wallet" title="No payment methods yet" description="Add a QR from your bank or e-wallet, or a payment link." />
        {:else}
          <SortableList label="Payment methods" items={methods} name={methodTitle} disabled={busy || editing !== null} on:reorder={saveOrder} let:item={m} let:handle>
            {@const logo = logoOf(m)}
            <Row muted={busy && confirming === m.id}>
              <svelte:fragment slot="leading">
                <DragHandle {handle} />
                {#if logo}
                  <Logo src={logo.logo} wordmark={!!logo.wordmark} />
                {:else}
                  <Monogram name={methodTitle(m)} />
                {/if}
              </svelte:fragment>

              {#if m.kind === 'qr' && editing === m.id}
                <form class="rename" on:submit|preventDefault={() => saveRename(m)}>
                  <Input
                    label="Name for {m.label}"
                    hideLabel
                    bind:value={draft}
                    maxlength={MAX_METHOD_LABEL_LENGTH}
                    autocomplete="off"
                    data-rename-field={m.id}
                    error={renameError}
                    hint="Up to {MAX_METHOD_LABEL_LENGTH} characters. Empty uses {defaultQrLabel(institutionById(m.institution))}."
                    on:focus={(e) => e.currentTarget.select()}
                    on:keydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename(m.id); } }}
                  />
                </form>
              {:else}
                <span class="clip" class:sr-only={m.kind === 'qr' && logoSpellsName(m.institution, m.label)}>{methodTitle(m)}</span>
              {/if}

              <svelte:fragment slot="subtitle">
                {#if editing === m.id}
                  <!-- The field's own hint line says what a name can be. -->
                {:else if confirming === m.id}
                  <span class="line">Remove it from your Pay button?</span>
                {:else if m.kind === 'qr'}
                  <span class="line" title="Pays to {titleCase(m.name)}">Pays to {titleCase(m.name)}</span>
                  <span class="line" title={qrPlace(m)}>{qrPlace(m)}</span>
                {:else}
                  <span class="line" title={m.url}>{displayUrl(m.url)}</span>
                {/if}
              </svelte:fragment>

              <svelte:fragment slot="meta">
                {#if m.kind === 'qr' && editing !== m.id}<span class="t-label currency" title="Pays in {m.currency}">{m.currency}</span>{/if}
              </svelte:fragment>

              <svelte:fragment slot="actions">
                {#if m.kind === 'qr' && editing === m.id}
                  <Button size="sm" variant="ghost" on:click={() => cancelRename(m.id)}>Cancel</Button>
                  <Button size="sm" loading={busy} on:click={() => saveRename(m)}>Save</Button>
                {:else if confirming === m.id}
                  <Button size="sm" variant="ghost" data-pay-cancel={m.id} disabled={busy} on:click={() => keep(m)}>Cancel</Button>
                  <Button size="sm" variant="danger" loading={busy} on:click={() => remove(m)}>Remove</Button>
                {:else}
                  {#if m.kind === 'qr'}
                    <IconButton icon="edit" label="Rename {m.label}" data-rename={m.id} disabled={busy} on:click={() => startRename(m)} />
                  {/if}
                  <IconButton icon="trash" variant="danger" label="Remove {methodTitle(m)}" data-pay-remove={m.id} disabled={busy} on:click={() => ask(m)} />
                {/if}
              </svelte:fragment>
            </Row>
          </SortableList>
        {/if}
      </Paper>

      {#if full}
        <p class="t-label t-muted">You have {MAX_PAY_METHODS} payment methods, the most a profile can have. Remove one to add another.</p>
      {:else}
        <Stack gap={12}>
          <Stack direction="row" gap={8} wrap>
            <Button variant={methods.length === 0 ? 'primary' : 'secondary'} icon="qr" loading={uploading} disabled={busy} on:click={() => fileInput.click()}>Add payment QR</Button>
            <Button icon="link" aria-expanded={linkOpen} aria-controls="pay-link" on:click={toggleLink}>Add payment link</Button>
          </Stack>
          <p class="t-caption t-muted">Pick one or more screenshots of the payment QR in your bank or e-wallet app. Each image is read, then discarded.</p>

          <!-- Progressive disclosure: the panel animates its height open, so nothing below jumps. -->
          <div id="pay-link" class="reveal" class:open={linkOpen} aria-hidden={!linkOpen} inert={!linkOpen}>
            <div>
              <form class="link-form" on:submit|preventDefault={addLink}>
                <Input
                  label="Payment link"
                  inputmode="url"
                  placeholder="https://paypal.me/you"
                  autocomplete="off"
                  spellcheck="false"
                  data-act="pay-link"
                  error={linkError}
                  hint="PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe."
                  bind:value={linkUrl}
                />
                <Button type="submit" loading={busy && !uploading && linkOpen} disabled={!linkUrl.trim()}>Add link</Button>
              </form>
            </div>
          </div>
        </Stack>
      {/if}

      <div class="msg" role="status">
        {#if error}
          <p class="err" role="alert">{error}</p>
        {:else if results.length === 1}
          <p class:err={!results[0].ok} class:ok={results[0].ok} role={results[0].ok ? undefined : 'alert'}>{results[0].text}</p>
        {:else if results.length > 1}
          <ul aria-label="Upload results">
            {#each results as r}<li class:err={!r.ok}>{r.file}: {r.text}</li>{/each}
          </ul>
        {/if}
      </div>

      <p class="note t-caption t-muted">
        <Icon name="info" />
        <span>
          <span class="block">Payers see the name in your QR, so check that it is yours.</span>
          <span class="block">Your QR may include your mobile number. Anyone who opens Pay can see it.</span>
        </span>
      </p>

      <input bind:this={fileInput} type="file" class="hidden" multiple on:change={onPick}
             accept="image/jpeg,image/png,image/webp,image/gif,image/avif" />
    </Stack>
  </div>
</Section>

<style>
  .clip,
  .line {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rename { margin: 4px 0 -4px; }
  .msg {
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .msg:empty { display: none; }
  .msg p,
  .msg ul { margin: 0; padding: 0; list-style: none; }
  .msg .ok { color: var(--success); }
  .err { margin: 0; color: var(--error); }
  .msg .err { color: var(--error); }
  .note {
    display: flex;
    gap: 8px;
    margin: 0;
  }
  .note :global(.ui-icon) { margin-top: 0; color: var(--text-faint); }
  .block { display: block; }
  p.t-caption { margin: 0; }

  /* Height animates from 0 to the content's own (DESIGN.md, progressive disclosure). */
  .reveal {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    visibility: hidden;
    transition: grid-template-rows var(--duration-normal) var(--ease-out), opacity var(--duration-normal) var(--ease-out), visibility 0s linear var(--duration-normal);
  }
  .reveal.open {
    grid-template-rows: 1fr;
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }
  .reveal > div { min-height: 0; overflow: hidden; }
  .link-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 12px;
    /* Room for the focus ring inside the clipped panel. */
    padding: 2px;
  }
  .link-form > :global(button) { margin-top: 26px; }
  @media (max-width: 639px) {
    .link-form { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .link-form > :global(button) { margin-top: 0; justify-self: start; }
  }
  /* Phones give the room to who it pays; the currency shows from 640px. */
  @media (max-width: 639px) {
    .currency { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal { transition: none; }
  }
</style>
