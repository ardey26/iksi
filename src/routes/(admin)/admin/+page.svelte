<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  export let data;

  $: qs = new URLSearchParams($page.url.search);
  function setParam(key: string, val: string | null) {
    const next = new URLSearchParams(qs);
    if (val === null) next.delete(key); else next.set(key, val);
    goto(`?${next.toString()}`, { keepFocus: true, noScroll: true });
  }
  function onBotsChange(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    setParam('bots', checked ? '1' : null);
  }
</script>

<section class="space-y-8">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-medium" style="color: var(--text-primary);">Analytics</h1>
    <label class="flex items-center gap-2 text-sm" style="color: var(--text-muted);">
      <input
        type="checkbox"
        checked={data.includeBots}
        on:change={onBotsChange}
      />
      Include bots
    </label>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {#each [
      { label: 'Total URLs', value: data.kpis.totalURLs },
      { label: 'URLs today', value: data.kpis.todayURLs },
      { label: 'Total clicks', value: data.kpis.totalClicks },
      { label: 'Clicks today', value: data.kpis.todayClicks }
    ] as k}
      <div class="p-4 rounded-md" style="background: var(--surface); border: 1px solid var(--border);">
        <div class="text-xs uppercase tracking-wide" style="color: var(--text-muted);">{k.label}</div>
        <div class="mt-1 text-2xl font-medium tabular-nums" style="color: var(--text-primary);">{k.value.toLocaleString()}</div>
      </div>
    {/each}
  </div>

  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Over time</h2>
      <div class="flex gap-1 text-xs">
        {#each [7, 30, 90] as d}
          <button
            on:click={() => setParam('range', String(d))}
            class="px-2 py-1 rounded"
            style="color: {data.days === d ? 'var(--text-primary)' : 'var(--text-muted)'}; background: {data.days === d ? 'var(--surface)' : 'transparent'}; border: 1px solid var(--border);"
          >{d}d</button>
        {/each}
      </div>
    </div>
    {#await data.streamed.timeSeries}
      <div class="h-64 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
    {:then ts}
      {#await import('$lib/components/admin/TimeSeriesChart.svelte') then Mod}
        <svelte:component this={Mod.default} labels={ts.labels} urls={ts.urls} clicks={ts.clicks} />
      {/await}
    {/await}
  </section>

  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Top links</h2>
      <div class="flex gap-1 text-xs">
        {#each [{ k: 'clicks', l: 'By clicks' }, { k: 'created', l: 'By newest' }] as opt}
          <button
            on:click={() => setParam('sort', opt.k)}
            class="px-2 py-1 rounded"
            style="color: {data.sort === opt.k ? 'var(--text-primary)' : 'var(--text-muted)'}; background: {data.sort === opt.k ? 'var(--surface)' : 'transparent'}; border: 1px solid var(--border);"
          >{opt.l}</button>
        {/each}
      </div>
    </div>
    {#await data.streamed.topLinks}
      <div class="h-64 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
    {:then rows}
      <div class="rounded-md overflow-hidden" style="border: 1px solid var(--border);">
        <table class="w-full text-sm">
          <thead style="background: var(--surface); color: var(--text-muted);">
            <tr>
              <th class="text-left px-3 py-2 font-normal">Short</th>
              <th class="text-left px-3 py-2 font-normal">Destination</th>
              <th class="text-right px-3 py-2 font-normal tabular-nums">Clicks</th>
              <th class="text-right px-3 py-2 font-normal tabular-nums">Created</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r}
              <tr style="border-top: 1px solid var(--border);">
                <td class="px-3 py-2 font-mono">{r.shortURL}</td>
                <td class="px-3 py-2 truncate max-w-[24rem]" title={r.originalURL}>{r.originalURL}</td>
                <td class="px-3 py-2 text-right tabular-nums">{r.clickCount.toLocaleString()}</td>
                <td class="px-3 py-2 text-right tabular-nums" style="color: var(--text-muted);">{new Date(r.createdAt).toISOString().slice(0, 10)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/await}
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Countries</h2>
    {#await data.streamed.countries}
      <div class="h-40 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
    {:then rows}
      {#await import('$lib/components/admin/HorizontalBars.svelte') then Mod}
        {@const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })}
        {@const display = rows.map((r) => ({
          label: r.isOther ? 'Other' : (r.country ? (regionNames.of(r.country) ?? r.country) : 'Unknown'),
          count: r.count,
          muted: !!r.isOther
        }))}
        <svelte:component this={Mod.default} rows={display} />
      {/await}
    {/await}
  </section>

  <section class="space-y-3">
    <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Referrers</h2>
    {#await data.streamed.referrers}
      <div class="h-40 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
    {:then rows}
      {#await import('$lib/components/admin/HorizontalBars.svelte') then Mod}
        {@const display = rows.map((r) => ({
          label: r.isDirect ? 'Direct' : (r.referrer ?? '—'),
          count: r.count,
          muted: !!r.isDirect
        }))}
        <svelte:component this={Mod.default} rows={display} />
      {/await}
    {/await}
  </section>

  <section class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {#await data.streamed.ua}
      <div class="h-40 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
      <div class="h-40 rounded-md" style="background: var(--surface); border: 1px solid var(--border);"></div>
    {:then ua}
      {#await import('$lib/components/admin/HorizontalBars.svelte') then Mod}
        <div class="space-y-3">
          <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Browsers</h2>
          <svelte:component this={Mod.default} rows={ua.browsers.map((b) => ({ label: b.browser ?? 'Unknown', count: b.count }))} />
        </div>
        <div class="space-y-3">
          <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Devices</h2>
          <svelte:component this={Mod.default} rows={ua.devices.map((d) => ({
            label: d.device ?? 'Unknown',
            count: d.count,
            muted: d.device === 'bot'
          }))} />
        </div>
      {/await}
    {/await}
  </section>
</section>
