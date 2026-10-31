<script>
  let { view, verdict = null, host = null } = $props();

  const VERDICTS = { malware: 'malware', phishing: 'phishing', unwanted: 'unwanted software' };
</script>

{#if view === 'expired'}
  <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
    This link has expired.
  </h1>
{:else}
  <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">Link disabled</h1>
  <p class="mt-2 text-sm" style="color: var(--text-muted);">
    This link was flagged by Google Safe Browsing as {VERDICTS[verdict] ?? verdict} and has been disabled.
  </p>
  {#if host}
    <p class="mt-4 text-sm break-all" style="color: var(--text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
      {host}
    </p>
  {/if}
{/if}
<a href="/" class="inline-block mt-6 text-sm hover:opacity-70 transition-opacity" style="color: var(--accent);">
  Back to iksi
</a>
