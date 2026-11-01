<script>
  // Why a short link will not open: expired (410), already opened (410) or
  // flagged (403). Shared by the link page and its error page.
  import { page } from '$app/state';
  import { Button } from '#lib/ui/index.js';
  import { appHref } from '#lib/subdomains.js';
  import Interstitial from '#lib/components/Interstitial.svelte';

  let { view, verdict = null, host = null } = $props();

  const VERDICTS = { malware: 'malware', phishing: 'phishing', unwanted: 'unwanted software' };

  const COPY = $derived(
    view === 'expired'
      ? {
          icon: 'clock',
          title: 'This link has expired',
          body: 'It stopped working on a date or after a set number of visits. Ask the sender for a new one.'
        }
      : view === 'opened'
        ? {
            icon: 'eye-off',
            title: 'This link was already opened',
            body: 'One-time links open once. Ask the sender for a new one.'
          }
        : {
            icon: 'alert',
            title: 'Link disabled',
            body: `This link was flagged by Google Safe Browsing as ${VERDICTS[verdict] ?? verdict} and has been disabled.`
          }
  );
  // On a profile subdomain `/` is the profile; iksi's home is on www.
  const home = $derived(appHref('/', page.url?.host ?? '', import.meta.env.DEV));
</script>

<Interstitial icon={COPY.icon} title={COPY.title} description={COPY.body}>
  <div class="stack">
    {#if view === 'flagged' && host}
      <p class="host t-mono">{host}</p>
    {/if}
    <Button variant="secondary" size="lg" full href={home}>Go to iksi</Button>
  </div>
</Interstitial>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .host {
    margin: -8px 0 0;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 20px;
    color: var(--text-muted);
    overflow-wrap: anywhere;
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
</style>
