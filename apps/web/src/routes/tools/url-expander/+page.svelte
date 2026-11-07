<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { URL_EXPANDER, VERDICT_BADGES, linkHost } from '#lib/marketing/link-tools.js';
  import { Badge, Button, Container, Input, List, PageHeader, Paper, Row, Section, Skeleton } from '#lib/ui/index.js';

  // Why a chain ended early. Matches the stop reasons of lib/server/expand.ts.
  const STOPS = {
    blocked: 'Stopped at an address on a private or local network. It was not followed.',
    'too-many-hops': 'Stopped after 10 hops. The link keeps redirecting.',
    timeout: 'Stopped: a hop took over 5 seconds to answer, or the chain over 10 seconds.',
    error: 'Stopped: a hop could not be reached.',
    'bad-url': 'Stopped: the next redirect is not a link it can safely follow.'
  };
  const REFUSED = 'Use an http or https link on a standard port, with no username or password.';

  let value = '';
  let error = '';
  let loading = false;
  /** The API's { hops, final, stopped, verdict } for the last link. */
  let result = null;

  const hostOf = (url) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  async function expand() {
    if (!linkHost(value)) {
      error = 'Enter a valid link, like bit.ly/abc.';
      return;
    }
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/tools/expand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value.trim() })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = body.error || 'Something went wrong. Try again.';
        result = null;
      } else if (body.stopped === 'bad-url' && !body.hops?.length) {
        error = REFUSED;
        result = null;
      } else {
        result = body;
      }
    } catch {
      error = 'Could not reach iksi. Try again.';
      result = null;
    } finally {
      loading = false;
    }
  }

  $: hops = result?.hops ?? [];
  $: verdict = result?.final ? (VERDICT_BADGES[result.verdict] ?? VERDICT_BADGES.unavailable) : null;
  $: summary = !result ? '' : result.stopped ? STOPS[result.stopped] ?? STOPS.error : `${hops.length} ${hops.length === 1 ? 'hop' : 'hops'}`;
</script>

<Container width="form" class="marketing">
  <PageHeader title="URL expander" description={URL_EXPANDER.answer} />

  <Section class="block">
    <Paper>
      <form on:submit|preventDefault={expand} novalidate>
        <Input label="Link" bind:value {error} placeholder="bit.ly/abc" />
        <Button type="submit" variant="primary" full {loading}>Expand link</Button>
      </form>
    </Paper>

    <!-- Reserves room for a typical chain, so a result fills space instead of pushing the page. -->
    <div class="result" data-result aria-live="polite">
      {#if loading}
        <Skeleton width="96px" height="18px" />
        <Paper padding="none">
          <List>
            {#each [0, 1] as i (i)}
              <Row>
                <Skeleton width="40%" height="22px" />
                <svelte:fragment slot="subtitle"><Skeleton width="70%" height="18px" /></svelte:fragment>
                <svelte:fragment slot="meta"><Skeleton width="32px" height="20px" /></svelte:fragment>
              </Row>
            {/each}
          </List>
        </Paper>
      {:else if result}
        <p class="t-label summary">{summary}</p>
        {#if hops.length}
          <Paper padding="none">
            <List label="Hops">
              {#each hops as hop, i (i)}
                <Row title={hostOf(hop.url)}>
                  <svelte:fragment slot="subtitle"><span title={hop.url}>{hop.url}</span></svelte:fragment>
                  <svelte:fragment slot="meta">{hop.status}</svelte:fragment>
                </Row>
              {/each}
            </List>
          </Paper>
        {/if}
        {#if result.final && verdict}
          <p class="t-label summary">Final destination</p>
          <Paper padding="none">
            <!-- Shown as text, never linked: it may be the page to avoid. -->
            <List label="Final destination">
              <Row title={hostOf(result.final)} subtitle={result.final} wrapSubtitle>
                <svelte:fragment slot="meta"><Badge variant={verdict.variant}>{verdict.label}</Badge></svelte:fragment>
              </Row>
            </List>
          </Paper>
          <p class="t-caption note">{verdict.note}</p>
        {/if}
      {/if}
    </div>
  </Section>

  <Section title="Check before you click" class="block">
    <Paper>
      <p class="t-body">
        To check a link without following it, use the <TextLink href="/tools/link-checker">link checker</TextLink>. To make links of your own, <TextLink href="/">shorten a link with iksi</TextLink>; every new link is checked against Google Safe Browsing.
      </p>
    </Paper>
  </Section>

  <Faq items={URL_EXPANDER.faq} />
</Container>

<style>
  form { display: grid; gap: 4px; }
  .result {
    min-height: 240px;
    margin-top: 16px;
    display: grid;
    align-content: start;
    gap: 8px;
  }
  .summary { margin: 8px 0 0; color: var(--text-muted); }
  .summary:first-child { margin-top: 0; }
  .note { margin: 0; color: var(--text-muted); }
</style>
