<script lang="ts">
  // Public profile Pay button and its sheet. Uses the profile palette
  // (--bg, --surface, --border, --text-primary, --text-muted) it sits in.
  import { onDestroy, tick } from 'svelte';
  import QRCode from 'qrcode';
  import { PAY_LABEL_TEXT, PROVIDER_NAMES, qrPlace, type PayLabel, type PublicPayMethod } from '#lib/pay-methods.js';

  export let handle: string;
  export let displayName: string;
  export let label: PayLabel = 'pay';
  /** Display info only. QR payloads usually hold the owner's mobile number, so they stay out of the cached page. */
  export let methods: PublicPayMethod[] = [];

  const QR_SIZE = 264;

  let open = false;
  let sheetEl: HTMLElement | undefined;
  let trigger: HTMLButtonElement;
  // Rendered PNGs by method id; a missing entry is still rendering.
  let images: Record<string, { url: string; file: File | null }> = {};
  // QR payloads by method id, fetched once when the sheet first opens.
  let payloads: Record<string, string> | null = null;
  let loading = false;
  let loadFailed = false;

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

  async function show() {
    open = true;
    document.body.style.overflow = 'hidden';
    load();
    await tick();
    sheetEl?.focus();
  }
  async function close() {
    if (!open) return;
    open = false;
    document.body.style.overflow = '';
    await tick();
    trigger?.focus();
  }

  onDestroy(() => {
    if (open && typeof document !== 'undefined') document.body.style.overflow = '';
  });

  function onWindowKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !sheetEl) return;
    const items = [...sheetEl.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheetEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
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

<button type="button" class="pay-btn" bind:this={trigger} on:click={show}
        aria-haspopup="dialog" aria-expanded={open}>{PAY_LABEL_TEXT[label]}</button>

{#if open}
  <div class="pay-root">
    <!-- Pointer-only shortcut; Escape and the close button cover keyboards. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="pay-backdrop" on:click={close}></div>
    <div class="pay-sheet" role="dialog" aria-modal="true" aria-labelledby="pay-sheet-title"
         tabindex="-1" bind:this={sheetEl} on:keydown={trapFocus}>
      <header class="pay-head">
        <h2 id="pay-sheet-title" class="pay-title">{title}</h2>
        <button type="button" class="pay-close" aria-label="Close" on:click={close}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <ul class="pay-list">
        {#each methods as m (m.id)}
          <li class="pay-item">
            {#if m.kind === 'qr'}
              <div class="qr-frame" style="width: {QR_SIZE}px;">
                {#if images[m.id]}
                  <img src={images[m.id].url} alt="Payment QR for {m.name}" width={QR_SIZE} height={QR_SIZE} />
                {:else if failed(m.id)}
                  <div class="qr-failed" role="alert">
                    <p>Could not load this QR.</p>
                    <button type="button" class="qr-retry" on:click={retry}>Try again</button>
                  </div>
                {/if}
              </div>
              <p class="pay-name">Pays to {m.name}</p>
              <p class="pay-meta">{qrPlace(m)}</p>
              <p class="pay-meta">Pays in {m.currency}</p>
              <div class="pay-action">
                {#if images[m.id]}
                  <a class="pay-secondary" href={images[m.id].url} download={fileName}
                     on:click={(e) => onSave(e, images[m.id].file)}>Save QR image</a>
                {:else}
                  <span class="pay-secondary pending" aria-hidden="true">Save QR image</span>
                {/if}
              </div>
              <p class="pay-note">Scan or upload this QR in your bank or e-wallet app.</p>
            {:else}
              <a class="pay-primary" href={m.url} target="_blank" rel="noopener">Pay with {PROVIDER_NAMES[m.provider]}</a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .pay-btn,
  .pay-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 48px;
    padding: 0 20px;
    border: none;
    border-radius: 9999px;
    font-size: 16px;
    font-weight: 500;
    color: var(--bg);
    background-color: var(--text-primary);
    cursor: pointer;
    transition: opacity var(--duration-normal) var(--ease-out);
  }
  .pay-btn:hover,
  .pay-primary:hover { opacity: 0.9; }
  .pay-btn:active,
  .pay-primary:active { transform: scale(0.98); }
  .pay-btn:focus-visible,
  .pay-primary:focus-visible,
  .pay-secondary:focus-visible,
  .pay-close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .pay-root {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .pay-backdrop {
    position: absolute;
    inset: 0;
    background-color: rgb(0 0 0 / 0.5);
    animation: pay-fade 200ms var(--ease-out);
  }
  .pay-sheet {
    position: relative;
    width: 100%;
    max-height: 92dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 8px 20px calc(24px + env(safe-area-inset-bottom));
    color: var(--text-primary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    outline: none;
    animation: pay-up 200ms var(--ease-out);
  }
  @media (min-width: 640px) {
    .pay-root { align-items: center; padding: 24px; }
    .pay-sheet {
      max-width: 420px;
      max-height: calc(100dvh - 48px);
      padding: 8px 28px 28px;
      border-bottom: 1px solid var(--border);
      border-radius: 20px;
    }
  }

  .pay-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
  }
  .pay-title {
    min-width: 0;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }
  .pay-close {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-right: -10px;
    color: var(--text-muted);
    background-color: transparent;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
  }
  .pay-close:hover { color: var(--text-primary); }

  .pay-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
    text-align: center;
    border-top: 1px solid var(--border);
  }
  .pay-item:first-child { border-top: none; padding-top: 8px; }
  .pay-item:last-child { padding-bottom: 0; }

  .qr-frame {
    flex: none;
    max-width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background-color: #ffffff;
    border-radius: 12px;
  }
  .qr-frame img { display: block; width: 100%; height: 100%; }
  /* The frame stays white in both themes, so its text is set dark. */
  .qr-failed {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    padding: 24px;
    font-size: 14px;
    color: #52525b;
  }
  .qr-retry {
    min-height: 44px;
    padding: 0 16px;
    font: inherit;
    font-weight: 500;
    color: #18181b;
    background-color: transparent;
    border: 1px solid #d4d4d8;
    border-radius: 9999px;
    cursor: pointer;
  }
  .qr-retry:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .pay-name {
    margin-top: 16px;
    font-size: 16px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .pay-meta {
    margin-top: 2px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .pay-action { margin-top: 16px; }
  .pay-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 9999px;
  }
  .pay-secondary:hover { border-color: var(--text-muted); }
  .pay-secondary.pending { opacity: 0.4; }
  .pay-note {
    max-width: 300px;
    margin-top: 12px;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }

  @keyframes pay-up {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes pay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pay-sheet,
    .pay-backdrop { animation: none; }
    .pay-btn,
    .pay-primary { transition: none; }
    .pay-btn:active,
    .pay-primary:active { transform: none; }
  }
</style>
