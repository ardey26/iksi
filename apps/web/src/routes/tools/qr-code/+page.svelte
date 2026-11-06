<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { tick } from 'svelte';
  import QRCode from 'qrcode';
  import { addPrefix } from '#lib/utils/urlValidation.js';
  import { QR_TOOL } from '#lib/marketing/qr-tool.js';
  import { Button, Container, Input, PageHeader, Paper, Section } from '#lib/ui/index.js';

  // Same colors and margin as the QR in the app; plain codes need less
  // error correction than the logo version, so M keeps them simpler to scan.
  const OPTIONS = { margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0A0A0B', light: '#FFFFFF' } };
  const BOX = 240;

  let value = '';
  let error = '';
  let canvas;
  let ready = false;
  let href = '';
  let generated = '';

  // Unlike the shortener, iksi links are fine here: people shorten first, then paste.
  function parse(input) {
    try {
      const u = new URL(addPrefix(input));
      const parts = u.hostname.split('.');
      const ok = ['http:', 'https:'].includes(u.protocol) && parts.length >= 2 && parts.every((x) => x.length > 0);
      return ok ? u.href && addPrefix(input) : '';
    } catch {
      return '';
    }
  }

  async function generate() {
    href = '';
    const url = parse(value);
    if (!url) {
      error = 'Enter a valid link, like example.com.';
      ready = false;
      return;
    }
    error = '';
    ready = true;
    generated = url;
    // The canvas mounts after the flush; its box already holds the size.
    await tick();
    try {
      await QRCode.toCanvas(canvas, url, { ...OPTIONS, width: BOX * 2 });
      href = await QRCode.toDataURL(url, { ...OPTIONS, width: 1024 });
    } catch {
      error = 'That link is too long for a QR code.';
      ready = false;
      href = '';
    }
  }
</script>

<Container width="form">
  <PageHeader title="QR code generator" description={QR_TOOL.answer} />

  <Section class="block">
    <Paper>
      <form on:submit|preventDefault={generate} novalidate>
        <Input label="Link" bind:value {error} placeholder="example.com" />
        <Button type="submit" variant="primary" full>Make QR code</Button>
      </form>
      <!-- Reserved at final size, so the page never shifts when the code appears. -->
      <div class="box" data-qr-box style="width: {BOX}px; height: {BOX}px;">
        {#if ready}
          <canvas bind:this={canvas} style="width: 100%; height: 100%;" aria-label="QR code for {generated}"></canvas>
        {/if}
      </div>
      <div class="actions">
        {#if ready}
          <Button variant="secondary" href={href || undefined} download="iksi-qr.png" disabled={!href}>Download PNG</Button>
        {/if}
      </div>
    </Paper>
  </Section>

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
  .box {
    margin: 16px auto 0;
    max-width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    border: 1px solid var(--border, currentColor);
    background: #fff;
    overflow: hidden;
  }
  canvas { display: block; }
  /* Holds the button's height whether or not it shows. */
  .actions { min-height: 44px; margin-top: 16px; display: grid; }
</style>
