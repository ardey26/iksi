<script lang="ts">
  // Public profile Pay button and its sheet (kit Sheet). Both use the profile
  // palette they sit in; the sheet carries it through its portal.
  import { tick } from 'svelte';
  import QRCode from 'qrcode';
  import { Button, Sheet } from '#lib/ui/index.js';
  import PayMark from './PayMark.svelte';
  import { logoSpellsName } from '#lib/pay-institutions.js';
  import {
    PAY_LABEL_TEXT,
    PROVIDER_NAMES,
    methodTitle,
    qrPlace,
    titleCase,
    type PayLabel,
    type PublicPayMethod
  } from '#lib/pay-methods.js';

  export let handle: string;
  export let displayName: string;
  export let label: PayLabel = 'pay';
  /** Display info only. QR payloads usually hold the owner's mobile number, so they stay out of the cached page. */
  export let methods: PublicPayMethod[] = [];

  const QR_SIZE = 264;

  let open = false;
  let root: HTMLElement;
  // Rendered PNGs by method id; a missing entry is still rendering.
  let images: Record<string, { url: string; file: File | null }> = {};
  // QR payloads by method id, fetched once when the sheet first opens.
  let payloads: Record<string, string> | null = null;
  let loading = false;
  let loadFailed = false;

  // With two or more methods a picker shows one at a time; the owner's first is the default.
  let selected: string | undefined = methods[0]?.id;
  $: if (!methods.some((m) => m.id === selected)) selected = methods[0]?.id;
  $: picking = methods.length > 1;
  $: shown = picking ? methods.filter((m) => m.id === selected) : methods;
  $: cols = methods.length <= 3 ? methods.length : methods.length === 4 ? 2 : 3;
  $: current = shown[0];
  // Links have no bank, so they always get a monogram of the service name.
  const institutionOf = (m: PublicPayMethod) => (m.kind === 'qr' ? m.institution : null);

  $: title = label === 'tip' ? `Send ${displayName} a tip` : `Pay ${displayName}`;
  $: fileName = `${handle}-payment-qr.png`;

  function fileOf(dataUrl: string): File | null {
    try {
      const bin = atob(dataUrl.split(',')[1] ?? '');
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new File([bytes], fileName, { type: 'image/png' });
    } catch {
      return null;
    }
  }

  async function load() {
    if (loading || payloads || !methods.some((m) => m.kind === 'qr')) return;
    loading = true;
    loadFailed = false;
    try {
      const res = await fetch(`/api/@${encodeURIComponent(handle)}/pay`);
      const body = res.ok ? await res.json() : null;
      if (body && typeof body.payloads === 'object' && body.payloads) payloads = body.payloads;
      else loadFailed = true;
    } catch {
      loadFailed = true;
    }
    loading = false;
    await render();
  }

  function retry() {
    payloads = null;
    load();
  }

  // A QR whose payload did not arrive (the request failed, or the page is older than the owner's last change).
  $: failed = (id: string) => loadFailed || (payloads !== null && !payloads[id]);

  async function render() {
    for (const m of methods) {
      const payload = payloads?.[m.id];
      if (m.kind !== 'qr' || !payload || images[m.id]) continue;
      try {
        // Black on white with a full quiet zone: what payment apps scan most reliably.
        const url = await QRCode.toDataURL(payload, {
          width: 1024,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        images = { ...images, [m.id]: { url, file: fileOf(url) } };
      } catch (e) {
        console.error('pay: QR render failed', e);
      }
    }
  }

  function show() {
    open = true;
    load();
  }

  // The kit sheet returns focus to whatever had it on open; a tap on a phone
  // may not focus the button, so the button takes it back explicitly.
  async function closed() {
    open = false;
    await tick();
    root?.querySelector<HTMLElement>('.pay-btn')?.focus();
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      closed();
    }
  }

  // On a phone, a download lands in Files, where payment apps cannot see it.
  // The share sheet offers "Save Image", which puts it in the photo gallery.
  function onSave(e: MouseEvent, file: File | null) {
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (!file || !touch || !navigator.canShare?.({ files: [file] })) return;
    e.preventDefault();
    navigator.share({ files: [file] }).catch(() => {});
  }
</script>

<svelte:window on:keydown={onWindowKeydown} />

<div class="pay" bind:this={root}>
  <Button variant="primary" size="lg" full class="pay-btn" aria-haspopup="dialog" aria-expanded={open} on:click={show}>
    {PAY_LABEL_TEXT[label]}
  </Button>
</div>

<Sheet bind:open {title} width={420} on:close={closed}>
  {#if picking}
    <div class="pick" role="radiogroup" aria-label="Payment method" style="--cols: {cols};">
      {#each methods as m (m.id)}
        <label class="key">
          <input type="radio" class="sr-only" name="pay-pick-{handle}" value={m.id} bind:group={selected} />
          <span class="key-face" title={methodTitle(m)}>
            <PayMark institution={institutionOf(m)} provider={m.kind === 'link' ? m.provider : null} label={methodTitle(m)} size={32} alt="" />
            <span class="pay-key-text" class:sr-only={logoSpellsName(institutionOf(m), methodTitle(m))}>{methodTitle(m)}</span>
          </span>
        </label>
      {/each}
    </div>
  {/if}

  <ul class="pay-list">
    {#each shown as m (m.id)}
      <li class="pay-item">
        {#if m.kind === 'qr'}
          <!-- With a picker, the chosen key already names the method. -->
          {#if !picking}
            <div class="pay-who">
              <PayMark institution={m.institution} label={m.label} size={32} alt="" />
              <p class="pay-method" class:sr-only={logoSpellsName(m.institution, m.label)}>{m.label}</p>
            </div>
          {/if}

          <div class="qr-frame" class:failed={!images[m.id] && failed(m.id)} style="max-width: {QR_SIZE}px;">
            {#if images[m.id]}
              <img src={images[m.id].url} alt="Payment QR for {titleCase(m.name)}" width={QR_SIZE} height={QR_SIZE} />
            {:else if failed(m.id)}
              <div class="qr-failed" role="alert">
                <p>Could not load this QR.</p>
                <Button size="sm" on:click={retry}>Try again</Button>
              </div>
            {/if}
          </div>

          <div class="pay-to">
            <p class="pay-name">Pays to {titleCase(m.name)}</p>
            <p class="pay-meta">{qrPlace(m)}</p>
            <p class="pay-meta">Pays in {m.currency}</p>
          </div>
          <p class="pay-note">Scan or upload this QR in your bank or e-wallet app.</p>
        {:else}
          {#if !picking}
            <div class="pay-who">
              <PayMark provider={m.provider} label={methodTitle(m)} size={32} alt="" />
              <p class="pay-method">{methodTitle(m)}</p>
            </div>
          {/if}
          <p class="pay-note">Opens {PROVIDER_NAMES[m.provider]} in a new tab. You pay {displayName} there.</p>
        {/if}
      </li>
    {/each}
  </ul>

  <svelte:fragment slot="footer">
    {#if current?.kind === 'qr'}
      {#if images[current.id]}
        <Button
          variant="primary"
          size="lg"
          href={images[current.id].url}
          download={fileName}
          on:click={(e) => onSave(e, images[current.id].file)}
        >
          Save QR image
        </Button>
      {:else}
        <Button variant="primary" size="lg" disabled>Save QR image</Button>
      {/if}
    {:else if current}
      <Button variant="primary" size="lg" href={current.url} target="_blank" rel="noopener" iconEnd="external">
        Pay with {PROVIDER_NAMES[current.provider]}
      </Button>
    {/if}
  </svelte:fragment>
</Sheet>

<style>
  .pay { width: 100%; }

  /* Picker: one key per method; the chosen one is outlined in the text colour. */
  .pick {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 24px;
  }
  .key {
    display: flex;
    min-width: 0;
    cursor: pointer;
  }
  .key-face {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 48px;
    padding: 0 10px 0 6px;
    color: var(--text-muted);
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    transition:
      border-color var(--duration-normal) var(--ease-out),
      color var(--duration-normal) var(--ease-out);
  }
  .key:hover .key-face {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .key input:checked + .key-face {
    color: var(--text-primary);
    background-color: var(--surface);
    border-color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--text-primary);
  }
  .key input:focus-visible + .key-face {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .pay-key-text {
    min-width: 0;
    overflow: hidden;
    font-size: 13px;
    line-height: 18px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pay-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .pay-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .pay-who {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-bottom: 16px;
    text-align: left;
  }
  .pay-method {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  /* White in both themes with a full quiet zone: what payment apps scan best. */
  .qr-frame {
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background-color: #FFFFFF;
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
  }
  .qr-frame img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .qr-frame.failed { background-color: var(--surface-2); }
  .qr-failed {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    padding: 24px;
  }
  .qr-failed p {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }

  .pay-to { margin-top: 16px; }
  .pay-name {
    margin: 0;
    font-size: 17px;
    line-height: 24px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }
  .pay-meta {
    margin: 2px 0 0;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .pay-note {
    max-width: 300px;
    margin: 16px 0 0;
    font-size: 12px;
    line-height: 16px;
    color: var(--text-faint);
  }

  @media (prefers-reduced-motion: reduce) {
    .key-face { transition: none; }
  }
</style>
