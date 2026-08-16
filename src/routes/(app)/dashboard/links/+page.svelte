<script lang="ts">
  export let data;
  let editing: number | null = null;
  let editValue = '';

  function startEdit(id: number, current: string) {
    editing = id; editValue = current;
  }
  async function saveEdit(id: number) {
    const res = await fetch('/dashboard/links', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, originalURL: editValue })
    });
    if (res.ok) location.reload(); else alert('Failed');
  }
  async function del(id: number) {
    if (!confirm('Delete this link? Rows that reference it will show "link removed".')) return;
    const res = await fetch('/dashboard/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) location.reload(); else alert('Failed');
  }
  function verdictColor(v: string | null) {
    if (v === null || v === undefined || v === 'safe') return 'var(--text-muted)';
    return 'var(--error)';
  }
</script>

<section class="max-w-6xl mx-auto space-y-6">
  <h1 class="text-xl font-medium" style="color: var(--text-primary);">Your links</h1>

  <div class="rounded-md overflow-hidden" style="border: 1px solid var(--border);">
    <table class="w-full text-sm">
      <thead style="background: var(--surface); color: var(--text-muted);">
        <tr>
          <th class="text-left px-3 py-2 font-normal">Short</th>
          <th class="text-left px-3 py-2 font-normal">Destination</th>
          <th class="text-right px-3 py-2 font-normal">Clicks</th>
          <th class="text-right px-3 py-2 font-normal">Verdict</th>
          <th class="text-right px-3 py-2 font-normal"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.links as l}
          <tr style="border-top: 1px solid var(--border);">
            <td class="px-3 py-2 font-mono">{l.shortURL}</td>
            <td class="px-3 py-2 truncate max-w-[24rem]">
              {#if editing === l.id}
                <input bind:value={editValue} class="w-full px-2 py-1 rounded"
                       style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);" />
              {:else}
                <span title={l.originalURL}>{l.originalURL}</span>
              {/if}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{l.clickCount}</td>
            <td class="px-3 py-2 text-right text-xs" style={`color: ${verdictColor(l.safeVerdict)};`}>
              {l.safeVerdict ?? '—'}
            </td>
            <td class="px-3 py-2 text-right space-x-2">
              {#if editing === l.id}
                <button on:click={() => saveEdit(l.id)} class="text-xs" style="color: var(--accent);">Save</button>
                <button on:click={() => (editing = null)} class="text-xs" style="color: var(--text-muted);">Cancel</button>
              {:else}
                <button on:click={() => startEdit(l.id, l.originalURL)} class="text-xs" style="color: var(--accent);">Edit</button>
                <button on:click={() => del(l.id)} class="text-xs" style="color: var(--error);">Delete</button>
              {/if}
            </td>
          </tr>
        {/each}
        {#if data.links.length === 0}
          <tr><td colspan="5" class="px-3 py-4 text-center" style="color: var(--text-muted);">No links yet. Shorten one at <a href="/" style="color: var(--accent);">iksi.app</a>.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>
