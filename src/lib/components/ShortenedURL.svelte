<script>
  import { createEventDispatcher } from 'svelte';
  import QRCode from 'qrcode';
  import { copyToClipboard } from '../utils/clipboard.js';

  export let shortURL;

  const dispatch = createEventDispatcher();

  // iksi brand mark — black disc, white chain links. Used as the center logo on the QR.
  const IKSI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0A0A0B"/><g transform="rotate(-45 12 12)" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"><rect x="4" y="10" width="7" height="4" rx="2"/><rect x="13" y="10" width="7" height="4" rx="2"/></g></svg>`;

  let copied = false;
  let showQR = false;
  let qrLoading = false;
  let qrCopied = false;
  let qrDataUrl = '';

  $: fullURL = typeof window !== 'undefined'
    ? `${location.protocol}//${location.host}/${shortURL}`
    : shortURL;

  $: displayURL = typeof window !== 'undefined'
    ? `${location.hostname.replace('www.', '')}/${shortURL}`
    : shortURL;

  const copy = async () => {
    const success = await copyToClipboard(fullURL);
    if (success) {
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    }
  };

  const loadLogo = () => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;base64,${btoa(IKSI_LOGO_SVG)}`;
  });

  const renderQRCanvas = async (size) => {
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, fullURL, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0A0A0B', light: '#FFFFFF' }
    });
    const ctx = canvas.getContext('2d');
    const logo = await loadLogo();
    const logoSize = Math.round(canvas.width * 0.22);
    const halo = Math.max(6, Math.round(canvas.width * 0.015));
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const x = cx - logoSize / 2;
    const y = cy - logoSize / 2;
    // Clear the modules behind the logo as a circle so it sits on a clean halo
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, logoSize / 2 + halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(logo, x, y, logoSize, logoSize);
    return canvas;
  };

  const canvasToBlob = (canvas) =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));

  const openQR = async () => {
    showQR = true;
    qrLoading = true;
    try {
      const canvas = await renderQRCanvas(560);
      qrDataUrl = canvas.toDataURL('image/png');
    } finally {
      qrLoading = false;
    }
  };

  const closeQR = () => {
    showQR = false;
    qrCopied = false;
  };

  const qrPngBlob = async () => {
    const canvas = await renderQRCanvas(1024);
    return await canvasToBlob(canvas);
  };

  const copyQR = async () => {
    try {
      const blob = await qrPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      qrCopied = true;
      setTimeout(() => { qrCopied = false; }, 1500);
    } catch (err) {
      await copyToClipboard(fullURL);
      qrCopied = true;
      setTimeout(() => { qrCopied = false; }, 1500);
    }
  };

  const downloadQR = async () => {
    const blob = await qrPngBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iksi-${shortURL}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape' && showQR) {
      e.stopImmediatePropagation();
      closeQR();
    }
  };

  const reset = () => {
    dispatch('reset');
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="space-y-4 fade-in">
  <!-- Reserved error space (matching Input) -->
  <div class="h-5"></div>

  <!-- Result display (same dimensions as input) -->
  <div
    class="w-full py-4 px-5 rounded-xl cursor-pointer transition-all glow-accent"
    style="background: var(--surface); border: 1px solid var(--accent);"
    on:click={copy}
    on:keydown={(e) => e.key === 'Enter' && copy()}
    role="button"
    tabindex="0"
    aria-label="Click to copy shortened URL"
  >
    <p
      class="text-lg font-medium truncate"
      style="color: var(--accent);"
    >
      {displayURL}
    </p>
  </div>

  <!-- Copy + QR row (same position as submit) -->
  <div class="flex items-stretch gap-3" style="min-height: 56px;">
    <button
      type="button"
      on:click={copy}
      class="flex-1 py-4 px-5 text-base font-medium rounded-xl transition-all flex items-center justify-center"
      style="background: var(--accent); color: var(--bg);"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
    <button
      type="button"
      on:click={openQR}
      class="rounded-xl transition-all flex items-center justify-center"
      style="
        width: 56px;
        background: var(--surface);
        border: 1px solid var(--border);
        color: var(--text-muted);
      "
      aria-haspopup="dialog"
      aria-label="Show QR code"
      title="Show QR code"
    >
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3z" />
        <path d="M20 14h1v3" />
        <path d="M14 20h3v1" />
        <path d="M20 20h1v1" />
      </svg>
    </button>
  </div>

  <!-- Reset link (same position as custom alias toggle) -->
  <div class="text-center">
    <button
      type="button"
      class="text-sm transition-colors hover:underline"
      style="color: var(--text-muted);"
      on:click={reset}
    >
      Shorten another
    </button>
  </div>
</div>

{#if showQR}
  <div
    class="qr-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="QR code for shortened link"
    on:click|self={closeQR}
    on:keydown={(e) => e.key === 'Enter' && e.target === e.currentTarget && closeQR()}
    tabindex="-1"
  >
    <div class="qr-modal" on:click|stopPropagation>
      <button
        type="button"
        class="qr-close"
        on:click={closeQR}
        aria-label="Close QR code"
        title="Close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="qr-canvas">
        {#if qrLoading || !qrDataUrl}
          <div class="spinner" style="color: var(--text-muted);"></div>
        {:else}
          <img src={qrDataUrl} alt="QR code for {displayURL}" />
        {/if}
      </div>

      <p class="qr-url">{displayURL}</p>

      <div class="qr-actions">
        <button
          type="button"
          class="qr-action"
          on:click={copyQR}
          disabled={!qrDataUrl}
          aria-label="Copy QR code image"
          title="Copy image"
        >
          {#if qrCopied}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            <span>Copied</span>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy</span>
          {/if}
        </button>
        <button
          type="button"
          class="qr-action"
          on:click={downloadQR}
          disabled={!qrDataUrl}
          aria-label="Download QR code as PNG"
          title="Download PNG"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          <span>Download</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .qr-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 24px;
    animation: qr-fade var(--duration-slow) ease;
  }

  .qr-modal {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 56px 24px 24px;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    animation: qr-rise var(--duration-slow) ease;
  }

  .qr-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--duration-normal) ease, background var(--duration-normal) ease;
  }
  .qr-close:hover { color: var(--text-primary); background: rgba(255,255,255,0.04); }
  .qr-close svg { width: 18px; height: 18px; }

  .qr-canvas {
    background: #FFFFFF;
    border-radius: 12px;
    padding: 8px;
    width: 296px;
    height: 296px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .qr-canvas img {
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: pixelated;
  }

  .qr-url {
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .qr-actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .qr-action {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border-radius: 12px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color var(--duration-normal) ease, color var(--duration-normal) ease;
  }
  .qr-action:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .qr-action:disabled { opacity: 0.5; cursor: not-allowed; }
  .qr-action svg { width: 16px; height: 16px; }

  @keyframes qr-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes qr-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
