<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, IconButton, Sheet } from '#lib/ui/index.js';
  import { copyToClipboard } from '../utils/clipboard.js';
  import { dataUrlToBlob, iksiQR } from '#lib/qr.js';

  export let shortURL;
  /** Shown in the reserved line above the result, e.g. for a one-time link. */
  export let note = '';

  const dispatch = createEventDispatcher();

  let copied = false;
  let showQR = false;
  let qrLoading = false;
  let qrCopied = false;
  let qrDataUrl = '';

  $: fullURL = typeof window !== 'undefined'
    ? `${location.protocol}//${location.host}/${shortURL}`
    : shortURL;

  const displayHost = typeof window !== 'undefined' ? location.hostname.replace('www.', '') : 'iksi.app';
  $: displayURL = `${displayHost}/${shortURL}`;

  const copy = async () => {
    const success = await copyToClipboard(fullURL);
    if (success) {
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    }
  };

  // The QR library loads on first use (inside iksiQR): most visitors never
  // open the QR, so the home page doesn't ship it.
  const openQR = async () => {
    showQR = true;
    if (qrDataUrl) return;
    qrLoading = true;
    try {
      qrDataUrl = await iksiQR(fullURL, 560);
    } finally {
      qrLoading = false;
    }
  };

  const closeQR = () => {
    showQR = false;
    qrCopied = false;
  };

  const qrPngBlob = async () => dataUrlToBlob(await iksiQR(fullURL, 1024));

  const copyQR = async () => {
    try {
      const blob = await qrPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      qrCopied = true;
      setTimeout(() => { qrCopied = false; }, 1500);
    } catch {
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

<!-- Row for row, the same heights as the form it replaces (mode row, bar,
     toggle row, message line), so the swap moves nothing: Copy lands where
     Shorten was and Shorten another where Custom name was. -->
<div class="result">
  <p class="head">Your short link</p>

  <div class="pill-bar actions">
    <a class="url t-mono" href={fullURL} target="_blank" rel="noopener" title={fullURL}
      ><span class="host">{displayHost}/</span>{shortURL}</a
    >
    <IconButton icon="qr" label="Show QR code" aria-haspopup="dialog" on:click={openQR} />
    <!-- Both labels hold the width, so Copied never resizes the button. -->
    <Button variant="primary" size="lg" on:click={copy}>
      <span class="swap">
        <span class:off={copied}>Copy</span>
        <span class:off={!copied} aria-hidden="true">Copied</span>
      </span>
    </Button>
  </div>

  <div class="pill-toggle">
    <Button variant="ghost" size="sm" on:click={reset}>Shorten another</Button>
  </div>

  <!-- The one line at the end, e.g. that a one-time link opens once. -->
  <p class="note pill-status">{note}</p>
  <span class="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
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
      <span class="swap">
        <span class:off={qrCopied}>Copy image</span>
        <span class:off={!qrCopied} aria-hidden="true">Copied</span>
      </span>
    </Button>
    <Button variant="primary" disabled={!qrDataUrl} on:click={downloadQR}>Download PNG</Button>
  </svelte:fragment>
</Sheet>

<style>
  /* Mirrors the home form: the 32px mode row and 16px under it, the bar,
     the toggle row, the message line. */
  .result {
    display: flex;
    flex-direction: column;
  }
  .head {
    display: flex;
    align-items: center;
    height: var(--control-sm);
    margin: 0 0 16px;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .note {
    overflow: hidden;
    color: var(--text-muted);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .url {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 17px;
    line-height: 24px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    text-overflow: ellipsis;
    text-decoration: none;
  }
  .host { color: var(--text-faint); }
  .url:hover { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  .url:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  /* Two labels in one cell: the wider one sets the width. */
  .swap { display: inline-grid; }
  .swap > span { grid-area: 1 / 1; text-align: center; }
  .swap > .off { visibility: hidden; }

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
