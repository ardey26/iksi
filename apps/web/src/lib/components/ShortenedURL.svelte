<script>
  import { createEventDispatcher } from 'svelte';
  import QRCode from 'qrcode';
  import { Button, IconButton, Sheet } from '#lib/ui/index.js';
  import { copyToClipboard } from '../utils/clipboard.js';

  export let shortURL;
  /** Shown in the reserved line above the result, e.g. for a one-time link. */
  export let note = '';

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
    if (qrDataUrl) return;
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

  const reset = () => {
    dispatch('reset');
  };
</script>

<div class="result">
  <div class="head">
    <p class="t-label t-muted">Your short link</p>
    <!-- Reserved line: the note never moves what is under it. -->
    <p class="note t-caption">{note}</p>
  </div>

  <div class="url-row">
    <a class="url t-mono" href={fullURL} target="_blank" rel="noopener" title={fullURL}>{displayURL}</a>
    <IconButton icon="qr" label="Show QR code" size="md" aria-haspopup="dialog" on:click={openQR} />
  </div>

  <div class="actions">
    <Button variant="ghost" size="sm" class="flush" on:click={reset}>Shorten another</Button>
    <Button variant="primary" icon={copied ? 'check' : 'copy'} on:click={copy}>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
    </Button>
  </div>
</div>

<Sheet bind:open={showQR} title="QR code" description={displayURL} width={400} on:close={closeQR}>
  <div class="qr">
    <div class="qr-frame">
      <!-- Reserved at full size; the image renders in a few milliseconds. -->
      {#if !qrLoading && qrDataUrl}
        <img src={qrDataUrl} alt="QR code for {displayURL}" width="280" height="280" />
      {/if}
    </div>
  </div>
  <svelte:fragment slot="footer">
    <Button icon={qrCopied ? 'check' : 'copy'} disabled={!qrDataUrl} on:click={copyQR}>
      {qrCopied ? 'Copied' : 'Copy image'}
    </Button>
    <Button variant="primary" disabled={!qrDataUrl} on:click={downloadQR}>Download PNG</Button>
  </svelte:fragment>
</Sheet>

<style>
  .result {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .head p { margin: 0; }
  .note {
    min-height: 16px;
    color: var(--text-muted);
    text-align: right;
  }
  .url-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--control-lg);
    padding: 4px 4px 4px 16px;
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
  .url {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 18px;
    line-height: 26px;
    font-weight: 500;
    color: var(--accent);
    white-space: nowrap;
    text-overflow: ellipsis;
    text-decoration: none;
  }
  .url:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  .url:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .actions :global(.flush) { margin-left: -10px; }

  .qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  /* White in both themes: what cameras read most reliably. */
  .qr-frame {
    display: flex;
    width: 100%;
    max-width: 296px;
    aspect-ratio: 1;
    padding: 8px;
    background-color: #FFFFFF;
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
  }
  .qr-frame img {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
