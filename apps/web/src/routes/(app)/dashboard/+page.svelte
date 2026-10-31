<script lang="ts">
  export let data;

  $: publicUrl = data.user.handle ? `iksi.app/@${data.user.handle}` : null;

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

  <!-- SECTION: Traffic (streamed) -->
  {#if data.streamed?.stats}
    <div class="space-y-4">
      <div>
        <h2 class="text-base font-medium" style="color: var(--text-primary);">Traffic</h2>
        <p class="text-sm mt-1" style="color: var(--text-muted);">All-time activity on your public page.</p>
      </div>
      <div class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
        {#await data.streamed.stats}
          <!-- Skeleton: keeps layout stable, subtle pulse -->
          <div class="grid grid-cols-3 divide-x" style="--tw-divide-opacity: 1;">
            {#each [0, 1, 2] as _}
              <div class="px-6 py-5 animate-pulse" style="border-color: var(--border);">
                <div class="h-8 rounded" style="background: var(--border); width: 60%;"></div>
                <div class="mt-3 h-3 rounded" style="background: var(--border); width: 40%;"></div>
              </div>
            {/each}
          </div>
        {:then s}
          {#if s.views === 0}
            <p class="px-6 py-8 text-sm text-center" style="color: var(--text-muted);">
              No one's stopped by yet. Share <span style="color: var(--text-primary);">iksi.app/@{data.user.handle}</span> to get traffic.
            </p>
          {:else}
            <div class="grid grid-cols-3 divide-x" style="--tw-divide-opacity: 1;">
              <div class="px-6 py-5" style="border-color: var(--border);">
                <div class="text-3xl font-semibold tabular-nums leading-none" style="color: var(--text-primary);">{fmt(s.views)}</div>
                <div class="mt-2 text-xs uppercase tracking-wide" style="color: var(--text-muted);">{s.views === 1 ? 'Visit' : 'Visits'}</div>
              </div>
              <div class="px-6 py-5" style="border-color: var(--border);">
                <div class="text-3xl font-semibold tabular-nums leading-none" style="color: var(--text-primary);">{fmt(s.clicks)}</div>
                <div class="mt-2 text-xs uppercase tracking-wide" style="color: var(--text-muted);">{s.clicks === 1 ? 'Click' : 'Clicks'}</div>
              </div>
              <div class="px-6 py-5" style="border-color: var(--border);">
                <div class="text-3xl font-semibold tabular-nums leading-none" style="color: var(--text-primary);">{(s.ctr * 100).toFixed(1)}<span class="text-xl" style="color: var(--text-muted);">%</span></div>
                <div class="mt-2 text-xs uppercase tracking-wide" style="color: var(--text-muted);">Clickthrough</div>
              </div>
            </div>
          {/if}
        {/await}
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
