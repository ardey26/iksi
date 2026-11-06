<script>
  import QRCode from 'qrcode';
  import { addPrefix, isValidURL } from '#lib/utils/urlValidation.js';
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

  async function generate() {
    if (!isValidURL(value)) {
      error = 'Enter a valid link, like example.com.';
      ready = false;
      href = '';
      return;
    }
    error = '';
    const url = addPrefix(value);
    ready = true;
    // The canvas mounts on the next tick; its box already holds the size.
    await Promise.resolve();
    await QRCode.toCanvas(canvas, url, { ...OPTIONS, width: BOX * 2 });
    href = await QRCode.toDataURL(url, { ...OPTIONS, width: 1024 });
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
          <canvas bind:this={canvas} style="width: 100%; height: 100%;" aria-label="QR code for {addPrefix(value)}"></canvas>
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
        A long link makes a dense QR code that is harder to scan. <a href="/">Shorten the link with iksi</a> first and the code stays small and simple. A short link's destination can also be changed later, so a printed code keeps working.
      </p>
    </Paper>
  </Section>

  <Section title="Questions" class="block">
    <Paper>
      <dl class="faq">
        {#each QR_TOOL.faq as item (item.q)}
          <dt class="t-label">{item.q}</dt>
          <dd class="t-body">{item.a}</dd>
        {/each}
      </dl>
    </Paper>
  </Section>
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
  .faq { margin: 0; display: grid; gap: 4px; }
  .faq dt { margin-top: 16px; color: var(--text-primary); }
  .faq dt:first-child { margin-top: 0; }
  .faq dd { margin: 0; color: var(--text-muted); }
</style>
