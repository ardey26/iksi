<script lang="ts">
  export let data;
</script>

<section class="space-y-8 max-w-6xl mx-auto">
  <h1 class="text-xl font-medium" style="color: var(--text-primary);">Dashboard</h1>

  {#if data.stats}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each [
        { label: 'Profile views', value: data.stats.views },
        { label: 'Total clicks', value: data.stats.clicks },
        { label: 'CTR', value: (data.stats.ctr * 100).toFixed(1) + '%' },
        { label: 'Active rows', value: data.stats.rowClicks.length }
      ] as k}
        <div class="p-4 rounded-md" style="background: var(--surface); border: 1px solid var(--border);">
          <div class="text-xs uppercase tracking-wide" style="color: var(--text-muted);">{k.label}</div>
          <div class="mt-1 text-2xl font-medium tabular-nums" style="color: var(--text-primary);">{k.value}</div>
        </div>
      {/each}
    </div>

    <div class="flex gap-4 text-sm">
      <a href="/dashboard/links" style="color: var(--accent);">Manage links →</a>
      <a href="/dashboard/profile" style="color: var(--accent);">Edit profile →</a>
      {#if data.user.handle}
        <a href={`/@${data.user.handle}`} target="_blank" style="color: var(--accent);">View public page →</a>
      {/if}
    </div>
  {/if}
</section>
