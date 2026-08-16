<script lang="ts">
  export let data;

  let editing: number | null = null;
  let editValue = '';
  let copiedId: number | null = null;

  function startEdit(id: number, current: string) {
    editing = id;
    editValue = current;
  }
  function cancelEdit() {
    editing = null;
    editValue = '';
  }
  async function saveEdit(id: number) {
    const res = await fetch('/dashboard/links', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, originalURL: editValue })
    });
    if (res.ok) location.reload();
    else alert('Failed to save.');
  }
  async function del(id: number, short: string) {
    if (!confirm(`Delete iksi.app/${short}? Rows on your profile that reference it will show "link removed".`)) return;
    const res = await fetch('/dashboard/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (res.ok) location.reload();
    else alert('Failed to delete.');
  }
  async function copy(id: number, short: string) {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/${short}`);
      copiedId = id;
      setTimeout(() => { if (copiedId === id) copiedId = null; }, 1400);
    } catch {}
  }
  function relDate(d: string | Date) {
    const dt = new Date(d);
    const diff = Date.now() - dt.getTime();
    const day = 86400000;
    if (diff < day) return 'today';
    if (diff < 2 * day) return 'yesterday';
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
    if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: dt.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }
  function hostOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u; }
  }
  function verdictLabel(v: string | null | undefined) {
    if (!v || v === 'safe' || v === 'pending') return null;
    return v;
  }

  // Profile row management
  let newRowLinkId: number | '' = data.links[0]?.id ?? '';
  let newRowTitle = '';

  // Local mutable copy of rows for optimistic drag-and-drop
  let rows: any[] = [...(data.profile?.rows ?? [])];
  let dragIndex: number | null = null;
  let dragOverIndex: number | null = null;

  async function rowAction(payload: any, reloadOnDone = true) {
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      if (reloadOnDone) location.reload();
      return true;
    }
    const body = await res.json().catch(() => ({}));
    alert(body.error || 'Failed');
    return false;
  }

  function confirmDeleteRow(rowId: number, title: string) {
    if (confirm(`Remove "${title}" from your public page?`)) rowAction({ action: 'deleteRow', rowId });
  }

  function onDragStart(e: DragEvent, index: number) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Firefox needs some data set to initiate drag
      e.dataTransfer.setData('text/plain', String(rows[index].id));
    }
  }
  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    dragOverIndex = index;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }
  function onDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }
  async function onDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    const from = dragIndex;
    dragIndex = null;
    dragOverIndex = null;
    if (from === null || from === targetIndex) return;

    // Optimistic reorder locally
    const moving = rows[from];
    const next = rows.slice();
    next.splice(from, 1);
    next.splice(targetIndex, 0, moving);
    rows = next;

    // Persist
    const ok = await rowAction({ action: 'reorderRows', orderedIds: rows.map((r) => r.id) }, false);
    if (!ok) {
      // Revert on failure
      rows = [...(data.profile?.rows ?? [])];
    }
  }
</script>

<svelte:head><title>Links — iksi</title></svelte:head>

<section class="w-full max-w-2xl mx-auto space-y-20">
  <header>
    <p class="text-sm mb-8" style="color: var(--text-muted);">
      <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
    </p>
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Links</h1>
  </header>

  <!-- SECTION: Your short URLs -->
  <div class="space-y-4">
    <div>
      <h2 class="text-base font-medium" style="color: var(--text-primary);">Your short URLs</h2>
      <p class="text-sm mt-1" style="color: var(--text-muted);">Everything you've shortened while signed in.</p>
    </div>

  {#if data.links.length === 0}
    <div class="py-16 text-center space-y-3 rounded-xl" style="background: var(--surface); border: 1px solid var(--border);">
      <p class="text-base" style="color: var(--text-muted);">Shorten a URL on the homepage while signed in and it'll appear here.</p>
      <a href="/" class="inline-block text-sm underline" style="color: var(--text-primary);">Go to homepage</a>
    </div>
  {:else}
    <ul class="rounded-xl overflow-hidden divide-y" style="background: var(--surface); border: 1px solid var(--border); --tw-divide-opacity: 1;">
      {#each data.links as l (l.id)}
        <li class="group px-4 py-4 transition-colors hover:bg-[color-mix(in_srgb,var(--text-primary)_3%,transparent)]"
            style="border-color: var(--border);"
            role="listitem">
          {#if editing === l.id}
            <div class="space-y-2">
              <div class="text-sm font-mono" style="color: var(--text-muted);">
                iksi.app/<span style="color: var(--text-primary);">{l.shortURL}</span>
              </div>
              <div class="flex gap-2">
                <input
                  bind:value={editValue}
                  autofocus
                  placeholder="https://..."
                  class="flex-1 px-3 py-2 text-sm rounded-md outline-none"
                  style="background: var(--surface); border: 1px solid var(--accent); color: var(--text-primary);"
                />
                <button
                  on:click={() => saveEdit(l.id)}
                  class="px-4 py-2 text-xs font-medium rounded-md transition-opacity hover:opacity-90"
                  style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer;"
                >Save</button>
                <button
                  on:click={cancelEdit}
                  class="px-4 py-2 text-xs rounded-md transition-opacity hover:opacity-70"
                  style="background: transparent; color: var(--text-muted); border: 1px solid var(--border); cursor: pointer;"
                >Cancel</button>
              </div>
            </div>
          {:else}
            <div class="flex items-start justify-between gap-4">
              <!-- LEFT: short + destination -->
              <div class="min-w-0 flex-1 space-y-1">
                <button
                  on:click={() => copy(l.id, l.shortURL)}
                  class="flex items-baseline gap-2 group/copy hover:opacity-80 transition-opacity"
                  style="background: transparent; border: none; cursor: pointer; padding: 0;"
                  title="Copy link"
                >
                  <span class="text-base font-mono" style="color: var(--text-muted);">iksi.app/</span>
                  <span class="text-base font-mono font-medium" style="color: var(--text-primary);">{l.shortURL}</span>
                  {#if copiedId === l.id}
                    <span class="text-xs" style="color: var(--accent);">copied</span>
                  {:else}
                    <svg class="w-3.5 h-3.5 opacity-0 group-hover/copy:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" style="color: var(--text-muted);">
                      <rect x="9" y="9" width="11" height="11" rx="2"/>
                      <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
                    </svg>
                  {/if}
                </button>

                <a
                  href={l.originalURL}
                  target="_blank"
                  rel="noopener"
                  class="block text-sm truncate hover:opacity-70 transition-opacity"
                  style="color: var(--text-muted);"
                  title={l.originalURL}
                >
                  <span style="color: var(--text-primary); opacity: 0.7;">{hostOf(l.originalURL)}</span><span style="opacity: 0.5;">{l.originalURL.replace(/^https?:\/\/(www\.)?[^/]+/, '') || '/'}</span>
                </a>
              </div>

              <!-- RIGHT: stats + actions -->
              <div class="shrink-0 flex flex-col items-end gap-1 min-w-[7rem]">
                <div class="text-sm tabular-nums" style="color: var(--text-primary);">
                  <span class="font-medium">{l.clickCount.toLocaleString()}</span>
                  <span class="text-xs ml-0.5" style="color: var(--text-muted);">{l.clickCount === 1 ? 'click' : 'clicks'}</span>
                </div>
                <div class="text-xs" style="color: var(--text-muted);">
                  {relDate(l.createdAt)}
                  {#if verdictLabel(l.safeVerdict)}
                    <span style="color: var(--error);"> · {verdictLabel(l.safeVerdict)}</span>
                  {/if}
                </div>
                <div class="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    on:click={() => startEdit(l.id, l.originalURL)}
                    aria-label="Edit destination"
                    title="Edit"
                    class="p-1.5 rounded-md hover:opacity-100 transition-opacity"
                    style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 0 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button
                    on:click={() => del(l.id, l.shortURL)}
                    aria-label="Delete link"
                    title="Delete"
                    class="p-1.5 rounded-md hover:opacity-100 transition-opacity"
                    style="color: var(--error); background: transparent; border: none; cursor: pointer;"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  </div>

  <!-- SECTION: Public page rows -->
  <div class="space-y-4">
    <div class="flex items-baseline justify-between gap-4">
      <div>
        <h2 class="text-base font-medium" style="color: var(--text-primary);">Public rows</h2>
        <p class="text-sm mt-1" style="color: var(--text-muted);">Curated links shown on your public page, in order.</p>
      </div>
      {#if data.user.handle}
        <a href={`/@${data.user.handle}`} target="_blank" rel="noopener" class="text-sm shrink-0 hover:opacity-70 transition-opacity" style="color: var(--text-muted);">View public →</a>
      {/if}
    </div>

    <div class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
      <table class="w-full text-sm">
        <thead>
          <tr style="border-bottom: 1px solid var(--border);">
            <th class="w-8 py-3"></th>
            <th class="text-left py-3 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Title</th>
            <th class="text-left py-3 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Link</th>
            <th class="w-20 text-left py-3 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Public</th>
            <th class="w-16 text-right py-3 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row.id)}
            <tr
              draggable="true"
              on:dragstart={(e) => onDragStart(e, i)}
              on:dragover={(e) => onDragOver(e, i)}
              on:dragend={onDragEnd}
              on:drop={(e) => onDrop(e, i)}
              class="group"
              style="border-top: 1px solid var(--border); opacity: {dragIndex === i ? '0.35' : '1'}; background: {dragOverIndex === i && dragIndex !== i ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'}; transition: opacity 120ms ease, background 120ms ease;"
            >
              <td class="pr-1 pl-2 align-middle text-center" style="cursor: grab;" title="Drag to reorder">
                <svg class="w-3.5 h-3.5 mx-auto opacity-30 group-hover:opacity-70 transition-opacity" viewBox="0 0 24 24" fill="currentColor" style="color: var(--text-muted);" aria-hidden="true">
                  <circle cx="9" cy="6" r="1.5"/>
                  <circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/>
                  <circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/>
                  <circle cx="15" cy="18" r="1.5"/>
                </svg>
              </td>
              <td class="py-3 pr-4 align-middle">
                <span class="text-sm truncate block" style="color: {row.enabled ? 'var(--text-primary)' : 'var(--text-muted)'};">{row.title}</span>
              </td>
              <td class="py-3 pr-4 align-middle">
                {#if row.link}
                  <span class="text-xs font-mono" style="color: var(--text-muted);">iksi.app/{row.link.shortURL}</span>
                {:else}
                  <span class="text-xs" style="color: var(--error);">deleted</span>
                {/if}
              </td>
              <td class="py-3 pr-4 align-middle">
                <button
                  role="switch"
                  aria-checked={row.enabled}
                  aria-label={row.enabled ? 'Hide from public page' : 'Show on public page'}
                  on:click={() => rowAction({ action: 'toggleRow', rowId: row.id, enabled: !row.enabled })}
                  class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                  style="background: {row.enabled ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
                >
                  <span
                    class="inline-block w-4 h-4 rounded-full transition-transform"
                    style="background: white; transform: translateX({row.enabled ? '18px' : '2px'});"
                  ></span>
                </button>
              </td>
              <td class="py-3 pr-4 align-middle text-right">
                <button
                  aria-label="Delete row"
                  title="Delete"
                  class="opacity-40 hover:opacity-100 transition-opacity"
                  style="color: var(--text-muted); background: transparent; border: none; cursor: pointer; padding: 4px;"
                  on:click={() => confirmDeleteRow(row.id, row.title)}
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}

          <!-- Add-row: integrated as a real table row -->
          <tr style="border-top: 1px solid var(--border);">
            <td class="py-3 pr-1 pl-2 align-middle text-center">
              <span class="text-sm leading-none" style="color: var(--text-muted); opacity: 0.5;">+</span>
            </td>
            <td class="py-2 pr-4 align-middle">
              <input
                type="text"
                bind:value={newRowTitle}
                maxlength="80"
                placeholder="New row title"
                class="w-full px-0 py-1.5 text-sm outline-none bg-transparent"
                style="color: var(--text-primary); border: none;"
              />
            </td>
            <td class="py-2 pr-4 align-middle">
              <div class="relative">
                <select bind:value={newRowLinkId}
                        class="appearance-none w-full pl-2 pr-7 py-1.5 rounded-md text-xs font-mono outline-none"
                        style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
                  {#if data.links.length === 0}
                    <option value="" disabled>No links</option>
                  {/if}
                  {#each data.links as l}
                    <option value={l.id}>iksi.app/{l.shortURL}</option>
                  {/each}
                </select>
                <svg class="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </td>
            <td class="py-2 pr-4 align-middle"></td>
            <td class="py-2 pr-4 align-middle text-right">
              <button
                class="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                style="color: var(--accent); background: transparent; border: none; cursor: pointer; padding: 0;"
                disabled={!newRowLinkId || !newRowTitle}
                on:click={() => rowAction({ action: 'addRow', linkId: newRowLinkId, title: newRowTitle })}
              >Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    {#if data.links.length === 0}
      <p class="text-xs" style="color: var(--text-muted);">Shorten a URL from the homepage first — you'll be able to add it as a row here.</p>
    {/if}
  </div>
</section>
