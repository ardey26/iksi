<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import QRDialog from '#lib/components/QRDialog.svelte';
  import { addPrefix } from '#lib/utils/urlValidation.js';
  import { iksiQR } from '#lib/qr.js';
  import { QR_TOOL } from '#lib/marketing/qr-tool.js';
  import { Button, Container, Input, PageHeader, Paper, Section } from '#lib/ui/index.js';

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
      // Made here, not in the dialog, so a too-long link shows its error in
      // this form. The same code as the homepage: one 1024px PNG with the mark.
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

  <!-- The same dialog as the homepage result: the page itself never grows. -->
  <QRDialog bind:open url={generated} {src} />

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
</style>
