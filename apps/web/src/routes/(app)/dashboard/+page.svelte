<script lang="ts">
  export let data;

  $: publicUrl = data.user.handle ? `iksi.app/@${data.user.handle}` : null;

  let copied = false;
  async function copyPublicUrl() {
    if (!data.user.handle) return;
    try {
      await navigator.clipboard.writeText(`https://www.iksi.app/@${data.user.handle}`);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {}
  }

  function fmt(n: number) {
    return n.toLocaleString();
  }
</script>

<svelte:head><title>Dashboard — iksi</title></svelte:head>

<section class="w-full max-w-2xl mx-auto">
  <header class="space-y-3 mb-12">
    {#if publicUrl}
      <div class="flex items-baseline gap-3 flex-wrap">
        <a
          href={`/@${data.user.handle}`}
          target="_blank"
          rel="noopener"
          class="text-3xl font-semibold tracking-tight hover:opacity-70 transition-opacity"
          style="color: var(--text-primary);"
        >
          {publicUrl}
        </a>
        <button
          type="button"
          on:click={copyPublicUrl}
          class="inline-flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
          style="color: var(--text-muted); background: transparent; border: none; cursor: pointer; padding: 0;"
          title="Copy link"
          aria-label="Copy link"
        >
          {#if copied}
            <span>copied</span>
          {:else}
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <rect x="9" y="9" width="11" height="11" rx="2"/>
              <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
            </svg>
            <span>Copy</span>
          {/if}
        </button>
      </div>
    {:else}
      <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Your dashboard</h1>
    {/if}
  </header>

  <!-- SECTION: Traffic (streamed) -->
  {#if data.streamed?.stats}
    <section class="d-section" aria-labelledby="d-traffic">
      <h2 class="d-title" id="d-traffic">Traffic</h2>
      <p class="d-desc">All-time activity on your public page.</p>
      {#await data.streamed.stats}
        <!-- Skeleton: keeps layout stable, subtle pulse -->
        <div class="stats" aria-hidden="true">
          {#each [0, 1, 2] as _}
            <div class="stat animate-pulse">
              <div class="h-8 rounded" style="background-color: var(--border); width: 60%;"></div>
              <div class="mt-3 h-3 rounded" style="background-color: var(--border); width: 40%;"></div>
            </div>
          {/each}
        </div>
      {:then s}
        {#if s.views === 0}
          <p class="stats empty">
            No one's stopped by yet. Share <span style="color: var(--text-primary);">iksi.app/@{data.user.handle}</span> to get traffic.
          </p>
        {:else}
          <div class="stats">
            <div class="stat">
              <div class="figure">{fmt(s.views)}</div>
              <div class="caption">{s.views === 1 ? 'Visit' : 'Visits'}</div>
            </div>
            <div class="stat">
              <div class="figure">{fmt(s.clicks)}</div>
              <div class="caption">{s.clicks === 1 ? 'Click' : 'Clicks'}</div>
            </div>
            <div class="stat">
              <div class="figure">{(s.ctr * 100).toFixed(1)}<span class="unit">%</span></div>
              <div class="caption">Clickthrough</div>
            </div>
          </div>
        {/if}
      {/await}
    </section>
  {/if}

  <!-- SECTION: Manage -->
  <section class="d-section" aria-labelledby="d-manage">
    <h2 class="d-title" id="d-manage">Manage</h2>
    <p class="d-desc">Update your links and public page settings.</p>
    <nav class="manage" aria-labelledby="d-manage">
      {#each [
        { href: '/dashboard/links', title: 'Links', desc: 'Edit or delete the short URLs you own.' },
        { href: '/dashboard/profile', title: 'Profile', desc: 'Change how your public page looks.' }
      ] as item}
        <a href={item.href} class="group item">
          <span class="flex flex-col min-w-0">
            <span class="item-title">{item.title}</span>
            <span class="item-desc">{item.desc}</span>
          </span>
          <svg class="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted);" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </a>
      {/each}
    </nav>
  </section>
</section>

<style>
  /* Readouts on a hairline strip: no box, vertical hairlines between. */
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-height: 105px;
    margin-top: 16px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .stats.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    font-size: 14px;
    text-align: center;
    color: var(--text-muted);
  }
  .stat {
    padding: 24px 20px 20px;
  }
  .stat:first-child {
    padding-left: 0;
  }
  .stat + .stat {
    border-left: 1px solid var(--border);
  }
  .figure {
    font-size: 30px;
    line-height: 1;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }
  .unit {
    margin-left: 2px;
    font-size: 18px;
    color: var(--text-muted);
  }
  .caption {
    margin-top: 10px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .manage {
    margin-top: 16px;
    border-top: 1px solid var(--border);
  }
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 72px;
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
  }
  .item:hover {
    opacity: 1;
  }
  .item-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
  }
  .item-desc {
    margin-top: 2px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .item:focus-visible {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }
  @media (max-width: 639px) {
    .stat {
      padding: 20px 12px 16px;
    }
    .figure {
      font-size: 24px;
    }
  }
</style>
