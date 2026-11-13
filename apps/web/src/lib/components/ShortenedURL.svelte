<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, IconButton } from '#lib/ui/index.js';
  import QRDialog from './QRDialog.svelte';
  import { copyToClipboard } from '../utils/clipboard.js';

  export let shortURL;
  /** Shown in the reserved line above the result, e.g. for a one-time link. */
  export let note = '';

  const dispatch = createEventDispatcher();

  let copied = false;
  // The QR library loads only when this opens (inside QRDialog): most
  // visitors never open the QR, so the home page doesn't ship it.
  let showQR = false;

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
    <IconButton icon="qr" label="Show QR code" aria-haspopup="dialog" on:click={() => (showQR = true)} />
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

<QRDialog bind:open={showQR} url={fullURL} description={displayURL} filename="iksi-{shortURL}.png" />

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

</style>
