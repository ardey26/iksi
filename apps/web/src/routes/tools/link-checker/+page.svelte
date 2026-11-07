<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { LINK_CHECKER, VERDICT_BADGES, linkHost } from '#lib/marketing/link-tools.js';
  import { Badge, Button, Container, Input, PageHeader, Paper, Section, Skeleton } from '#lib/ui/index.js';

  let value = '';
  let error = '';
  let loading = false;
  /** { host, verdict } of the last check. */
  let result = null;

  async function check() {
    const host = linkHost(value);
    if (!host) {
      error = 'Enter a valid link, like example.com.';
      return;
    }
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/tools/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value.trim() })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = body.error || 'Something went wrong. Try again.';
        result = null;
      } else {
        result = { host, verdict: VERDICT_BADGES[body.verdict] ?? VERDICT_BADGES.unavailable };
      }
    } catch {
      error = 'Could not reach iksi. Try again.';
      result = null;
    } finally {
      loading = false;
    }
  }
</script>

<Container width="form" class="marketing">
  <PageHeader title="Link checker" description={LINK_CHECKER.answer} />

  <Section class="block">
    <Paper>
      <form on:submit|preventDefault={check} novalidate>
        <Input label="Link" bind:value {error} placeholder="example.com" />
        <Button type="submit" variant="primary" full {loading}>Check link</Button>
      </form>
      <!-- Empty until there is something to show; a result appears below the form, so nothing above moves. -->
      <div class="result" class:filled={loading || result} data-result aria-live="polite">
        {#if loading}
          <div class="line"><Skeleton width="72px" height="20px" /></div>
          <Skeleton width="100%" height="22px" />
        {:else if result}
          <div class="line">
            <Badge variant={result.verdict.variant}>{result.verdict.label}</Badge>
            <span class="t-caption host">{result.host}</span>
          </div>
          <p class="t-body note">{result.verdict.note}</p>
        {/if}
      </div>
    </Paper>
  </Section>

  <Section title="Where does it lead?" class="block">
    <Paper>
      <p class="t-body">
        A short link hides its destination. The <TextLink href="/tools/url-expander">URL expander</TextLink> follows it and checks where it ends up. To make links of your own, <TextLink href="/">shorten a link with iksi</TextLink>; every new link is checked against Google Safe Browsing.
      </p>
    </Paper>
  </Section>

  <Faq items={LINK_CHECKER.faq} />
</Container>

<style>
  form { display: grid; gap: 4px; }
  .result {
    display: grid;
    align-content: start;
    gap: 8px;
  }
  .result.filled { margin-top: 16px; }
  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 20px;
  }
  .host {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
  }
  .note { margin: 0; color: var(--text-muted); }
</style>
