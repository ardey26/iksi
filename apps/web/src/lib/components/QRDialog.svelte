<script>
  // The one QR dialog: the home page result and /tools/qr-code both open it.
  // A centered Sheet as tall as the code, the code with the iksi mark in a
  // white frame, then Copy image and Download PNG.
  import { Button, Sheet } from '#lib/ui/index.js';
  import { copyToClipboard } from '#lib/utils/clipboard.js';
  import { dataUrlToBlob, iksiQR } from '#lib/qr.js';

  export let open = false;
  /** What the code encodes; also copied when the browser cannot copy images. */
  export let url;
  /** The line under the title. Default: the URL. */
  export let description = '';
  export let filename = 'iksi-qr.png';
  /**
   * A PNG data URL made by the caller (the tool makes it first, to show a
   * too-long error in its form). Without one, the dialog makes it on open.
   */
  export let src = '';

  // One 1024px PNG is both what shows and what downloads.
  const SIZE = 1024;

  let made = '';
  let madeFor = '';
  let copied = false;
  let copiedTimer;

  $: png = src || made;
  $: if (open && !src && url && madeFor !== url) render(url);

  async function render(text) {
    madeFor = text;
    made = '';
    made = await iksiQR(text, SIZE);
  }

  // The image itself where the browser can put one on the clipboard; the
  // link otherwise, so the button always does something useful.
  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': dataUrlToBlob(png) })]);
    } catch {
      if (!(await copyToClipboard(url))) return;
    }
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1500);
  }

  const close = () => (copied = false);
</script>

<Sheet bind:open title="QR code" description={description || url} width={400} placement="center" on:close={close}>
  <div class="result">
    <!-- Reserved at full size; the image renders in a few milliseconds. -->
    <div class="qr-frame" data-qr-frame>
      {#if png}<img src={png} alt="QR code for {url}" width="280" height="280" />{/if}
    </div>
  </div>
  <svelte:fragment slot="footer">
    <!-- Both labels hold the width, so Copied never resizes the button. -->
    <Button icon={copied ? 'check' : 'copy'} disabled={!png} on:click={copy}>
      <span class="swap">
        <span class:off={copied}>Copy image</span>
        <span class:off={!copied} aria-hidden="true">Copied</span>
      </span>
    </Button>
    <Button variant="primary" href={png || undefined} download={filename} disabled={!png}>Download PNG</Button>
  </svelte:fragment>
  <span class="sr-only" aria-live="polite">{copied ? 'QR code copied' : ''}</span>
</Sheet>

<style>
  .result {
    display: flex;
    justify-content: center;
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
  /* Two labels in one cell: the wider one sets the width. */
  .swap { display: inline-grid; }
  .swap > span { grid-area: 1 / 1; text-align: center; }
  .swap > .off { visibility: hidden; }
</style>
