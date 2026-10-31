<script lang="ts">
  export let rows: Array<{ label: string; count: number; muted?: boolean }>;
  $: max = Math.max(1, ...rows.map((r) => r.count));
</script>

{#if rows.length === 0}
  <p class="text-sm" style="color: var(--text-muted);">No data yet.</p>
{:else}
  <ul class="space-y-2">
    {#each rows as r}
      <li class="flex items-center gap-3">
        <span class="w-28 shrink-0 text-sm truncate" style="color: {r.muted ? 'var(--text-muted)' : 'var(--text-primary)'};" title={r.label}>{r.label}</span>
        <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
          <div class="h-full" style="width: {(r.count / max) * 100}%; background: {r.muted ? 'var(--chart-3)' : 'var(--chart-1)'};"></div>
        </div>
        <span class="w-14 text-right text-sm tabular-nums" style="color: var(--text-muted);">{r.count.toLocaleString()}</span>
      </li>
    {/each}
  </ul>
{/if}
