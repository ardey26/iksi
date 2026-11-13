<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { addPrefix } from '#lib/utils/urlValidation.js';
  import { copyToClipboard } from '#lib/utils/clipboard.js';
  import { dataUrlToBlob, iksiQR } from '#lib/qr.js';
  import { QR_TOOL } from '#lib/marketing/qr-tool.js';
  import { Button, Container, Input, PageHeader, Paper, Section, Sheet } from '#lib/ui/index.js';


  let value = '';
  let error = '';
  let src = '';
  let generated = '';
  let open = false;
  let copied = false;
  let copiedTimer;

  // The image itself where the browser can put one on the clipboard; the
  // link otherwise, so the button always does something useful.
  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': dataUrlToBlob(src) })]);
    } catch {
      if (!(await copyToClipboard(generated))) return;
    }
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1500);
  }

  // Unlike the shortener, iksi links are fine here: people shorten first, then paste.
  function parse(input) {
    try {
      const u = new URL(addPrefix(input));
      const parts = u.hostname.split('.');
      const ok = ['http:', 'https:'].includes(u.protocol) && parts.length >= 2 && parts.every((x) => x.length > 0);
      return ok ? addPrefix(input) : '';
    } catch {
      return '';
    }
  }

  async function generate() {
    src = '';
    const url = parse(value);
    if (!url) {
      error = 'Enter a valid link, like example.com.';
      return;
    }
    error = '';
    try {
      // The same code as the homepage, iksi mark in the middle. One 1024px
      // PNG is both what shows and what downloads.
      src = await iksiQR(url, 1024);
      generated = url;
      open = true;
    } catch {
      error = 'That link is too long for a QR code.';
    }
  }
</script>

<Container width="form" class="marketing">
  <PageHeader title="QR code generator" description={QR_TOOL.answer} />

  <Section class="block">
    <Paper>
      <form on:submit|preventDefault={generate} novalidate>
        <Input label="Link" bind:value {error} placeholder="example.com" />
        <Button type="submit" variant="primary" full>Make QR code</Button>
      </form>
    </Paper>
  </Section>

  <!-- The code opens over the page, like the homepage QR: the page itself never grows. -->
  <Sheet bind:open title="QR code" description={generated} width={400}>
    {#if src}
      <div class="result">
        <div class="qr-frame" data-qr-frame>
          <img {src} alt="QR code for {generated}" width="280" height="280" />
        </div>
      </div>
    {/if}
    <svelte:fragment slot="footer">
      <!-- Both labels hold the width, so Copied never resizes the button. -->
      <Button icon={copied ? 'check' : 'copy'} on:click={copy}>
        <span class="swap">
          <span class:off={copied}>Copy image</span>
          <span class:off={!copied} aria-hidden="true">Copied</span>
        </span>
      </Button>
      <Button variant="primary" href={src} download="iksi-qr.png">Download PNG</Button>
    </svelte:fragment>
    <span class="sr-only" aria-live="polite">{copied ? 'QR code copied' : ''}</span>
  </Sheet>

  <Section title="Shorten it first" class="block">
    <Paper>
      <p class="t-body">
        A long link makes a dense QR code that is harder to scan. <TextLink href="/">Shorten the link with iksi</TextLink> first and the code stays small and simple. Sign in before you shorten and you can change the destination later, so a printed code keeps working.
      </p>
    </Paper>
  </Section>

  <Faq items={QR_TOOL.faq} />
</Container>

<style>
  form { display: grid; gap: 4px; }
  .result {
    display: flex;
    justify-content: center;
  }
  /* Two labels in one cell: the wider one sets the width. */
  .swap { display: inline-grid; }
  .swap > span { grid-area: 1 / 1; text-align: center; }
  .swap > .off { visibility: hidden; }
  /* Same frame as the homepage QR: white in both themes, what cameras read best. */
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
