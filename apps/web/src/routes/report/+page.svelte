<script>
  // Report a link: a visitor tells us a short link leads somewhere harmful.
  // No account needed. Every accepted report gets the same thanks, whether or
  // not the link exists (see lib/server/reports.ts).
  import { untrack } from 'svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { Button, Container, Input, PageHeader, Paper, Select, Textarea } from '#lib/ui/index.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
  import { appHref } from '#lib/subdomains.js';
  import { DETAILS_MAX, EMAIL_MAX, HONEYPOT, LINK_INPUT_MAX, REPORT_REASONS, REPORT_THANKS } from '#lib/report.js';

  let { data, form } = $props();

  const REASONS = [{ value: '', label: 'Choose a reason', disabled: true }, ...REPORT_REASONS];

  // What was typed survives a failed submit, with or without JavaScript. Read
  // once: after that the fields own their values.
  const typed = untrack(() => form?.values ?? null);
  let link = $state(typed?.link ?? untrack(() => data.link) ?? '');
  let reason = $state(typed?.reason ?? '');
  let details = $state(typed?.details ?? '');
  let email = $state(typed?.email ?? '');
  let submitting = $state(false);

  let errors = $derived(form?.errors ?? {});
  let sent = $derived(form?.sent === true);
  const home = $derived(appHref('/', page.url?.host ?? '', import.meta.env.DEV));

  const submit = () => {
    submitting = true;
    return async ({ update }) => {
      await update({ reset: false });
      submitting = false;
    };
  };
</script>

<svelte:head>
  <title>Report a link | iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if sent}
  <Interstitial icon="check" title={REPORT_THANKS} description="You can close this page.">
    <Button variant="secondary" size="lg" full href={home}>Go to iksi</Button>
  </Interstitial>
{:else}
  <Container width="narrow" class="report-page">
    <PageHeader
      title="Report a link"
      description="Tell us about a short link that leads to phishing, malware or other harm. No account needed."
    />
    <Paper>
      <form method="POST" class="form" novalidate use:enhance={submit}>
        <Input
          label="Short link"
          name="link"
          mono
          placeholder="iksi.app/abc"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength={LINK_INPUT_MAX}
          bind:value={link}
          error={errors.link ?? ''}
        />
        <Select label="Reason" name="reason" options={REASONS} bind:value={reason} error={errors.reason ?? ''} />
        <Textarea
          label="Details"
          optional
          name="details"
          rows={3}
          maxlength={DETAILS_MAX}
          placeholder="What the link showed or asked for"
          hint="Up to 1,000 characters."
          bind:value={details}
          error={errors.details ?? ''}
        />
        <Input
          label="Email"
          optional
          type="email"
          name="email"
          autocomplete="email"
          maxlength={EMAIL_MAX}
          hint="Only if you want to hear back."
          bind:value={email}
          error={errors.email ?? ''}
        />
        <!-- Honeypot: off screen and out of the tab order, so only bots fill it. -->
        <div class="trap" aria-hidden="true">
          <label>Website <input type="text" name={HONEYPOT} tabindex="-1" autocomplete="off" /></label>
        </div>
        <p class="status" aria-live="polite">{errors.form ?? ''}</p>
        <Button type="submit" variant="primary" size="lg" full loading={submitting}>Send report</Button>
      </form>
    </Paper>
    <p class="foot t-caption t-faint">
      What we keep from a report, and for how long: <a href="/privacy#reports">Privacy</a>
    </p>
  </Container>
{/if}

<style>
  :global(.report-page) {
    padding-top: clamp(24px, 8vh, 80px);
    padding-bottom: 64px;
  }
  :global(.report-page) > :global(.page-header) { margin-bottom: 24px; }
  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .foot {
    margin: 16px 0 0;
    text-align: center;
  }
  /* A quiet text link, like the interstitial footer line. 44px tall to tap. */
  .foot a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin: -14px 0;
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    border-radius: 4px;
    transition: color var(--duration-normal) var(--ease-out);
  }
  .foot a:hover { color: var(--text-muted); }
  .foot a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .trap {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }
  /* Reserved, so a message never moves the button. */
  .status {
    min-height: 16px;
    margin: -8px 0 8px;
    font-size: 12px;
    line-height: 16px;
    color: var(--error);
    text-align: center;
  }
</style>
