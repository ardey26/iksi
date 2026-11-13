<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { addPrefix } from '#lib/utils/urlValidation.js';
  import { QR_TOOL } from '#lib/marketing/qr-tool.js';
  import { Button, Container, Input, PageHeader, Paper, Section, Sheet } from '#lib/ui/index.js';

  // Same colors and margin as the QR in the app; plain codes need less
  // error correction than the logo version, so M keeps them simpler to scan.
  // One 1024px PNG is both what shows and what downloads, like the homepage QR.
  const OPTIONS = { margin: 2, errorCorrectionLevel: 'M', width: 1024, color: { dark: '#0A0A0B', light: '#FFFFFF' } };

  let value = '';
  let error = '';
  let src = '';
  let generated = '';
  let open = false;

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
      // Loaded on first use, so the page itself ships without it.
      const { default: QRCode } = await import('qrcode');
      src = await QRCode.toDataURL(url, OPTIONS);
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
      <Button variant="primary" href={src} download="iksi-qr.png">Download PNG</Button>
    </svelte:fragment>
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
