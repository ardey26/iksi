<script lang="ts">
  // Open link reports, grouped by link: what was reported, how often and why,
  // and the two actions. "Disable link" stops it for good; "Dismiss" closes
  // the reports and lifts a review hold.
  import { enhance } from '$app/forms';
  import { Badge, Button, Container, EmptyState, List, PageHeader, Paper, Row, Stack } from '#lib/ui/index.js';
  import { formatCount, relativeDate } from '#lib/format.js';
  import { reasonLabel } from '#lib/report.js';

  let { data, form } = $props();

  let confirmId: number | null = $state(null);
  let busyId: number | null = $state(null);

  const VERDICTS: Record<string, string> = { malware: 'Malware', phishing: 'Phishing', unwanted: 'Unwanted software' };

  /** Mid-sentence, "Yesterday" reads "yesterday"; a date ("Oct 20") keeps its capital. */
  const inSentence = (s: string) => (/^[A-Z][a-z]{2} \d/.test(s) ? s : s.toLowerCase());

  function reportCount(n: number) {
    return `${formatCount(n)} open ${n === 1 ? 'report' : 'reports'}`;
  }

  const submit = (linkId: number) => () => {
    busyId = linkId;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busyId = null;
      confirmId = null;
    };
  };
</script>

<svelte:head>
  <title>Reports | iksi admin</title>
</svelte:head>

<Container width="wide">
  <PageHeader
    title="Reports"
    description="Open reports from visitors, grouped by link. Most recently reported first."
    back="/admin"
    backLabel="Overview"
  />

  <Stack gap={16}>
    <p class="status" aria-live="polite">
      {#if form?.error}<span class="error">{form.error}</span>
      {:else if form?.done === 'disabled'}Link disabled.
      {:else if form?.done === 'dismissed'}Reports dismissed.{/if}
    </p>

    <Paper padding="none">
      {#if data.groups.length === 0}
        <EmptyState icon="inbox" title="No open reports" description="New reports show up here." />
      {:else}
        <List label="Reported links">
          {#each data.groups as g (g.linkId)}
            <Row wrapSubtitle class="report-row" muted={busyId === g.linkId}>
              <span class="short t-mono">iksi.app/{g.shortURL}</span>
              <svelte:fragment slot="subtitle">
                <span class="line" title={g.destination ?? undefined}>{g.host ?? 'One-time link, content hidden'}</span>
                <span class="line badges">
                  {#if g.moderation === 'disabled'}<Badge variant="error">Disabled</Badge>
                  {:else if g.moderation === 'review'}<Badge variant="warning">Under review</Badge>{/if}
                  {#if VERDICTS[g.safeVerdict ?? '']}<Badge variant="error">{VERDICTS[g.safeVerdict ?? '']}</Badge>{/if}
                  {#each g.reasons as r (r.reason)}<Badge>{reasonLabel(r.reason)} {formatCount(r.count)}</Badge>{/each}
                </span>
                {#if g.latestDetails}<span class="line details">"{g.latestDetails}"</span>{/if}
                <span class="line">
                  {#if confirmId === g.linkId}
                    Disable it? It stops working everywhere and comes off profile pages.
                  {:else}
                    {reportCount(g.total)}, last {inSentence(relativeDate(g.latestAt, data.now))}
                  {/if}
                </span>
              </svelte:fragment>
              <svelte:fragment slot="actions">
                {#if confirmId === g.linkId}
                  <Button size="sm" variant="ghost" disabled={busyId !== null} on:click={() => (confirmId = null)}>Cancel</Button>
                  <form method="POST" action="?/disable" use:enhance={submit(g.linkId)}>
                    <input type="hidden" name="linkId" value={g.linkId} />
                    <Button type="submit" size="sm" variant="danger" loading={busyId === g.linkId}>Disable link</Button>
                  </form>
                {:else}
                  <form method="POST" action="?/dismiss" use:enhance={submit(g.linkId)}>
                    <input type="hidden" name="linkId" value={g.linkId} />
                    <Button type="submit" size="sm" disabled={busyId !== null}>Dismiss</Button>
                  </form>
                  <Button size="sm" variant="danger" disabled={busyId !== null} on:click={() => (confirmId = g.linkId)}>
                    Disable link
                  </Button>
                {/if}
              </svelte:fragment>
            </Row>
          {/each}
        </List>
      {/if}
    </Paper>
  </Stack>
</Container>

<style>
  .short {
    overflow-wrap: anywhere;
  }
  .line {
    display: block;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 4px 0;
  }
  .details {
    color: var(--text-primary);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  /* Reserved, so a message never moves the list. */
  .status {
    min-height: 18px;
    margin: -32px 0 0;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .error { color: var(--error); }
  /* Phones: the actions drop under the text so it keeps the full width. */
  @media (max-width: 639px) {
    :global(.report-row) {
      flex-wrap: wrap;
      padding-top: 12px;
      padding-bottom: 12px;
    }
    :global(.report-row) > :global(.text) { flex-basis: 100%; }
    :global(.report-row) > :global(.actions) {
      justify-content: flex-end;
      width: 100%;
    }
  }
</style>
