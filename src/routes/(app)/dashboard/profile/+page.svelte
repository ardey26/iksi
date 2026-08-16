<script lang="ts">
  export let data;

  let displayName = data.profile?.displayName ?? '';
  let bio = data.profile?.bio ?? '';
  let avatarUrl = data.profile?.avatarUrl ?? '';
  let theme = data.profile?.theme ?? 'default';
  let accent = data.profile?.accent ?? '#3B82F6';
  let publicClicks = !!data.profile?.publicClicks;

  let newRowLinkId: number | '' = data.ownedLinks[0]?.id ?? '';
  let newRowTitle = '';

  async function saveProfile() {
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProfile', displayName, bio, avatarUrl, theme, accent, publicClicks })
    });
    if (!res.ok) alert('Save failed'); else location.reload();
  }

  async function post(payload: any) {
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) location.reload(); else alert('Failed');
  }

  function confirmDelete(rowId: number) {
    if (confirm('Delete row?')) post({ action: 'deleteRow', rowId });
  }
</script>

<section class="max-w-3xl mx-auto space-y-10">
  <h1 class="text-xl font-medium" style="color: var(--text-primary);">Profile</h1>

  <div class="space-y-4">
    <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Details</h2>
    <label class="block">
      <span class="text-sm" style="color: var(--text-muted);">Display name</span>
      <input type="text" bind:value={displayName} maxlength="80"
             class="mt-1 w-full px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);" />
    </label>
    <label class="block">
      <span class="text-sm" style="color: var(--text-muted);">Bio (≤200 chars)</span>
      <textarea bind:value={bio} maxlength="200" rows="3"
                class="mt-1 w-full px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);"></textarea>
    </label>
    <label class="block">
      <span class="text-sm" style="color: var(--text-muted);">Avatar URL</span>
      <input type="url" bind:value={avatarUrl}
             class="mt-1 w-full px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);" />
    </label>
    <div class="flex gap-6">
      <label class="block">
        <span class="text-sm" style="color: var(--text-muted);">Theme</span>
        <select bind:value={theme} class="mt-1 px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
          <option value="default">default (dark)</option>
          <option value="light">light</option>
          <option value="mono">mono</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm" style="color: var(--text-muted);">Accent</span>
        <input type="color" bind:value={accent} class="mt-1 h-10 w-16 rounded-md" style="background: var(--surface); border: 1px solid var(--border);" />
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm" style="color: var(--text-muted);">
      <input type="checkbox" bind:checked={publicClicks} />
      Show click counts publicly
    </label>
    <button on:click={saveProfile} class="px-4 py-2 rounded-md text-sm font-medium" style="background: var(--accent); color: white;">
      Save profile
    </button>
  </div>

  <div class="space-y-4">
    <h2 class="text-sm uppercase tracking-wide" style="color: var(--text-muted);">Rows</h2>
    <ul class="space-y-2">
      {#each data.profile?.rows ?? [] as row}
        <li class="flex items-center gap-3 p-3 rounded-md" style="background: var(--surface); border: 1px solid var(--border);">
          <span class="flex-1 truncate" style={`color: ${row.enabled ? 'var(--text-primary)' : 'var(--text-muted)'};`}>
            <strong>{row.title}</strong>
            <span class="text-xs" style="color: var(--text-muted);">→ /{row.link?.shortURL ?? '(deleted)'}</span>
          </span>
          <button class="text-xs" style="color: var(--text-muted);" on:click={() => post({ action: 'moveRow', rowId: row.id, direction: 'up' })}>↑</button>
          <button class="text-xs" style="color: var(--text-muted);" on:click={() => post({ action: 'moveRow', rowId: row.id, direction: 'down' })}>↓</button>
          <button class="text-xs" style="color: var(--accent);" on:click={() => post({ action: 'toggleRow', rowId: row.id, enabled: !row.enabled })}>
            {row.enabled ? 'Hide' : 'Show'}
          </button>
          <button class="text-xs" style="color: var(--error);" on:click={() => confirmDelete(row.id)}>Delete</button>
        </li>
      {/each}
    </ul>

    <div class="flex gap-2 items-end">
      <label class="block flex-1">
        <span class="text-sm" style="color: var(--text-muted);">Link</span>
        <select bind:value={newRowLinkId} class="mt-1 w-full px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
          {#each data.ownedLinks as l}
            <option value={l.id}>{l.shortURL}</option>
          {/each}
        </select>
      </label>
      <label class="block flex-1">
        <span class="text-sm" style="color: var(--text-muted);">Title</span>
        <input type="text" bind:value={newRowTitle} maxlength="80" class="mt-1 w-full px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);" />
      </label>
      <button
        class="px-4 py-2 rounded-md text-sm font-medium"
        style="background: var(--accent); color: white;"
        disabled={!newRowLinkId || !newRowTitle}
        on:click={() => post({ action: 'addRow', linkId: newRowLinkId, title: newRowTitle })}
      >Add row</button>
    </div>
  </div>
</section>
