<script lang="ts">
  export let data;

  $: publicUrl = data.user.handle ? `iksi.app/@${data.user.handle}` : null;
  $: totalViews = data.stats?.views ?? 0;
  $: totalClicks = data.stats?.clicks ?? 0;
  $: ctr = data.stats ? (data.stats.ctr * 100).toFixed(1) : '0.0';

  let copied = false;
  async function copyPublicUrl() {
    if (!data.user.handle) return;
    try {
      await navigator.clipboard.writeText(`https://iksi.app/@${data.user.handle}`);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {}
  }

  function fmt(n: number) {
    return n.toLocaleString();
  }
</script>

<svelte:head><title>Dashboard — iksi</title></svelte:head>

<section class="w-full max-w-2xl mx-auto space-y-12">
  <header class="space-y-3">
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

  <!-- SECTION: Traffic -->
  {#if data.stats}
    <div class="space-y-4">
      <div>
        <h2 class="text-base font-medium" style="color: var(--text-primary);">Traffic</h2>
        <p class="text-sm mt-1" style="color: var(--text-muted);">All-time activity on your public page.</p>
      </div>
      <div class="rounded-xl px-6 py-6" style="background: var(--surface); border: 1px solid var(--border);">
        <p class="text-2xl leading-relaxed" style="color: var(--text-primary);">
          {#if totalViews === 0}
            <span style="color: var(--text-muted);">No one's stopped by yet.</span>
          {:else}
            <span class="font-semibold tabular-nums">{fmt(totalViews)}</span>
            <span style="color: var(--text-muted);">{totalViews === 1 ? 'visit' : 'visits'}</span>
            <span style="color: var(--text-muted);"> · </span>
            <span class="font-semibold tabular-nums">{fmt(totalClicks)}</span>
            <span style="color: var(--text-muted);">{totalClicks === 1 ? 'click' : 'clicks'}</span>
            {#if totalViews > 0}
              <span style="color: var(--text-muted);"> · </span>
              <span class="font-semibold tabular-nums">{ctr}%</span>
              <span style="color: var(--text-muted);">clickthrough</span>
            {/if}
          {/if}
        </p>
      </div>
    </div>
  {/if}

  <!-- SECTION: Manage -->
  <div class="space-y-4">
    <div>
      <h2 class="text-base font-medium" style="color: var(--text-primary);">Manage</h2>
      <p class="text-sm mt-1" style="color: var(--text-muted);">Update your links and public page settings.</p>
    </div>
    <nav class="rounded-xl overflow-hidden divide-y" style="background: var(--surface); border: 1px solid var(--border);" aria-label="Manage">
      {#each [
        { href: '/dashboard/links', title: 'Links', desc: 'Edit or delete the short URLs you own.' },
        { href: '/dashboard/profile', title: 'Profile', desc: 'Change how your public page looks.' }
      ] as item}
        <a
          href={item.href}
          class="group flex items-center justify-between px-5 py-4 hover:bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)] transition-colors"
          style="border-color: var(--border);"
        >
          <span class="flex flex-col">
            <span class="text-base font-medium" style="color: var(--text-primary);">{item.title}</span>
            <span class="text-sm mt-0.5" style="color: var(--text-muted);">{item.desc}</span>
          </span>
          <svg class="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </a>
      {/each}
    </nav>
  </div>
</section>
