<script lang="ts">
  import ApiKeys from '#lib/components/ApiKeys.svelte';
  import {
    Button,
    Container,
    Icon,
    IconButton,
    List,
    Monogram,
    PageHeader,
    Paper,
    Row,
    Section,
    Skeleton,
    toast
  } from '#lib/ui/index.js';
  import { formatCount } from '#lib/format.js';
  import { profileHref, profileLabel, profileShareUrl } from '#lib/subdomains.js';

  export let data;

  $: subdomains = !!data.subdomains;
  $: handle = data.user.handle as string | null;
  $: publicUrl = handle ? profileLabel(handle, subdomains) : null;

  async function copyPublicUrl() {
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(profileShareUrl(handle, subdomains));
      toast('Link copied', { variant: 'success' });
    } catch {
      toast('Could not copy the link', { variant: 'error' });
    }
  }

  const STATS = ['Visits', 'Clicks', 'Clickthrough'];

  function figures(s: { views: number; clicks: number; ctr: number }) {
    return [formatCount(s.views), formatCount(s.clicks), `${(s.ctr * 100).toFixed(1)}%`];
  }

  const MANAGE = [
    { href: '/dashboard/links', title: 'Links', desc: 'Short links and one-time links', icon: 'link' },
    { href: '/dashboard/profile', title: 'Profile', desc: 'Name, look and the Pay button', icon: 'settings' }
  ] as const;
</script>

<svelte:head><title>Dashboard — iksi</title></svelte:head>

<Container width="form">
  <PageHeader title="Dashboard" description="Your public page, your links and the keys that use them.">
    <svelte:fragment slot="actions">
      <Button variant="primary" icon="plus" href="/dashboard/links#new">New link</Button>
    </svelte:fragment>
  </PageHeader>

  {#if publicUrl && handle}
    <Section title="Your page" description="Share it anywhere. Traffic counts every visit since you joined.">
      <Paper padding="none">
        <List label="Your page">
          <Row>
            <Monogram slot="leading" name={handle} />
            <a class="address t-mono" href={profileHref(handle, subdomains)} target="_blank" rel="noopener">{publicUrl}</a>
            <svelte:fragment slot="subtitle">Public page</svelte:fragment>
            <svelte:fragment slot="actions">
              <IconButton icon="copy" label="Copy link" on:click={copyPublicUrl} />
            </svelte:fragment>
          </Row>
        </List>

        {#if data.streamed?.stats}
          <div class="traffic">
            {#await data.streamed.stats}
              <dl class="stats" aria-busy="true">
                {#each STATS as label (label)}
                  <div class="stat">
                    <dt class="t-label t-muted">{label}</dt>
                    <dd><Skeleton width="64px" height="26px" /></dd>
                  </div>
                {/each}
              </dl>
            {:then s}
              {#if s.views === 0}
                <p class="quiet t-body t-muted">No visits yet. Share your page to get some.</p>
              {:else}
                <dl class="stats">
                  {#each figures(s) as figure, i (STATS[i])}
                    <div class="stat">
                      <dt class="t-label t-muted">{STATS[i]}</dt>
                      <dd class="t-title t-tabular figure">{figure}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
            {:catch}
              <p class="quiet t-body t-muted">Traffic could not be loaded. Reload to try again.</p>
            {/await}
          </div>
        {/if}
      </Paper>
    </Section>
  {/if}

  <Section title="Manage">
    <Paper padding="none">
      <nav aria-label="Manage">
        <List>
          {#each MANAGE as item (item.href)}
            <Row interactive style="position: relative;">
              <span slot="leading" class="tile"><Icon name={item.icon} /></span>
              <a class="stretch" href={item.href}>{item.title}</a>
              <svelte:fragment slot="subtitle">{item.desc}</svelte:fragment>
              <span slot="meta" class="chevron"><Icon name="chevron-right" /></span>
            </Row>
          {/each}
        </List>
      </nav>
    </Paper>
  </Section>

  <Section title="Connected apps" description="Apps that shorten links as you, like the iksi browser extension.">
    <ApiKeys keys={data.apiKeys ?? []} />
  </Section>
</Container>

<style>
  .address {
    display: inline-block;
    /* A 44px tall hit area on the one-line link, without moving the text. */
    padding: 11px 0;
    margin: -11px 0;
    color: var(--text-primary);
    text-decoration: none;
    border-radius: 4px;
  }
  .address:hover { color: var(--accent); }
  .address:focus-visible,
  .stretch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .traffic { border-top: 1px solid var(--border); }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
  }
  .stat {
    min-width: 0;
    padding: 16px;
  }
  .stat + .stat { border-left: 1px solid var(--border); }
  .stat dd { margin: 4px 0 0; }
  .figure {
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
  /* Same height as the figures, so the strip never changes size. */
  .quiet {
    display: flex;
    align-items: center;
    min-height: 80px;
    margin: 0;
    padding: 0 16px;
  }

  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--text-muted);
    background-color: var(--surface-2);
    border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .stretch {
    color: inherit;
    text-decoration: none;
    border-radius: 4px;
  }
  /* The whole row is the link's hit area. */
  .stretch::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  .chevron {
    display: inline-flex;
    color: var(--text-faint);
  }
</style>
