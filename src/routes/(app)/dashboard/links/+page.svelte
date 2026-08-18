<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  export let data;

  type Link = {
    id: number;
    shortURL: string;
    originalURL: string;
    clickCount: number;
    createdAt: string | Date;
    safeVerdict: string | null;
    profileRow: { id: number; title: string; enabled: boolean; position: number } | null;
  };

  // Local mutable copy for optimistic UI. Only re-sync when loader data
  // reference actually changes — otherwise we'd clobber pending optimistic
  // updates every reactive pass.
  let links: Link[] = [...data.links];
  let _linksRef = data.links;
  $: if (data.links !== _linksRef) {
    _linksRef = data.links;
    links = [...data.links];
  }

  let copiedId: number | null = null;
  let editingTitleId: number | null = null;

  function hostOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u; }
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
  function verdictLabel(v: string | null | undefined) {
    if (!v || v === 'safe' || v === 'pending') return null;
    return v;
  }
  async function copy(id: number, short: string) {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/${short}`);
      copiedId = id;
      setTimeout(() => { if (copiedId === id) copiedId = null; }, 1400);
    } catch {}
  }

  // --- Mutations ---

  async function apiUpsertRow(link: Link, title: string, enabled: boolean) {
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsertRow', linkId: link.id, title, enabled })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Failed');
      return null;
    }
    const body = await res.json();
    return body.row as { id: number; title: string; enabled: boolean; position: number };
  }

  async function togglePublish(link: Link) {
    const currentTitle = link.profileRow?.title?.trim() || hostOf(link.originalURL) || link.shortURL;
    const nextEnabled = !(link.profileRow?.enabled ?? false);

    // Optimistic
    links = links.map((l) =>
      l.id === link.id
        ? {
            ...l,
            profileRow: {
              id: l.profileRow?.id ?? -1,
              position: l.profileRow?.position ?? Number.MAX_SAFE_INTEGER,
              title: currentTitle,
              enabled: nextEnabled
            }
          }
        : l
    );

    const row = await apiUpsertRow(link, currentTitle, nextEnabled);
    if (!row) {
      // Revert
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: link.profileRow } : l));
    } else {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
    }
  }

  async function saveTitle(link: Link, newTitle: string) {
    const title = newTitle.trim();
    editingTitleId = null;
    if (!title) {
      // Blank title on a row that has no ProfileRow yet = nothing to persist.
      if (!link.profileRow) return;
      // Blank title on an existing row: we treat it as "remove from public",
      // which requires deleting the ProfileRow entirely (title is NOT NULL).
      const res = await fetch('/dashboard/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteRow', rowId: link.profileRow.id })
      });
      if (res.ok) {
        links = links.map((l) => (l.id === link.id ? { ...l, profileRow: null } : l));
      }
      return;
    }
    if (link.profileRow && link.profileRow.title === title) return;

    const enabled = link.profileRow?.enabled ?? false;
    const row = await apiUpsertRow(link, title, enabled);
    if (row) {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
    }
  }

  async function del(link: Link) {
    if (!confirm(`Delete iksi.app/${link.shortURL}? This also removes it from your public page.`)) return;
    const prev = links;
    links = links.filter((l) => l.id !== link.id);
    const res = await fetch('/dashboard/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: link.id })
    });
    if (!res.ok) {
      links = prev;
      alert('Failed to delete.');
    }
  }

  // --- Add-row ---
  let newURL = '';
  let newTitle = '';
  let newPublish = true;
  let adding = false;
  let addError = '';

  function isValidUrl(s: string) {
    if (!s) return false;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return !!u.hostname && u.hostname.includes('.');
    } catch { return false; }
  }
  $: canAdd = isValidUrl(newURL) && !adding;

  async function add() {
    if (!canAdd) return;
    adding = true;
    addError = '';
    try {
      const url = newURL.trim();
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longURL: url, customURL: '' })
      });
      const body = await res.json();
      if (!res.ok) {
        addError = body.error || 'Could not shorten.';
        return;
      }

      let addedLink: Link | null = body.link
        ? { ...body.link, profileRow: null }
        : null;

      if (!addedLink && body.shortURL) {
        // Dedupe path: server returned an existing shortURL without the full
        // link object. Reload loader to pick it up.
        await invalidateAll();
        addedLink = links.find((l) => l.shortURL === body.shortURL) ?? null;
      } else if (addedLink) {
        // Optimistic prepend.
        links = [addedLink, ...links];
      }

      const wantsPublic = newPublish;
      const title = newTitle.trim() || hostOf(url) || addedLink?.shortURL || '';
      if (addedLink && (title && (wantsPublic || newTitle.trim().length > 0))) {
        const row = await apiUpsertRow(addedLink, title, wantsPublic);
        if (row) {
          links = links.map((l) => (l.id === addedLink!.id ? { ...l, profileRow: row } : l));
        }
      }

      newURL = '';
      newTitle = '';
      newPublish = true;
    } catch {
      addError = 'Network error.';
    } finally {
      adding = false;
    }
  }

  // --- Drag reorder (only among rows that are on the public page) ---
  let dragId: number | null = null;
  let dragOverId: number | null = null;

  function isPublic(l: Link) { return !!l.profileRow?.enabled; }

  function onDragStart(e: DragEvent, l: Link) {
    if (!isPublic(l)) { e.preventDefault(); return; }
    dragId = l.id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(l.id));
    }
  }
  function onDragOver(e: DragEvent, l: Link) {
    if (dragId === null || !isPublic(l)) return;
    e.preventDefault();
    dragOverId = l.id;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }
  function onDragEnd() { dragId = null; dragOverId = null; }
  async function onDrop(e: DragEvent, target: Link) {
    e.preventDefault();
    const from = dragId;
    dragId = null; dragOverId = null;
    if (from === null || from === target.id || !isPublic(target)) return;

    const publicLinks = links.filter(isPublic);
    const fromIdx = publicLinks.findIndex((l) => l.id === from);
    const toIdx = publicLinks.findIndex((l) => l.id === target.id);
    if (fromIdx < 0 || toIdx < 0) return;

    const moving = publicLinks[fromIdx];
    const reordered = publicLinks.slice();
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moving);

    // Splice the reordered publics back into the full list where the first
    // public used to be (preserving private links' relative positions below).
    const firstPubPos = links.findIndex(isPublic);
    const withoutPubs = links.filter((l) => !isPublic(l));
    const next = [...reordered, ...withoutPubs];
    // Preserve any leading non-public links? Public-first is our sort rule, so
    // we don't need to worry about it — sort emits publics first anyway.
    links = next;

    const orderedIds = reordered.map((l) => l.profileRow!.id);
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorderRows', orderedIds })
    });
    if (!res.ok) invalidateAll();
  }
</script>

<svelte:head><title>Links — iksi</title></svelte:head>

<section class="w-full max-w-2xl mx-auto space-y-8">
  <header class="flex items-baseline justify-between gap-4">
    <div>
      <p class="text-sm mb-8" style="color: var(--text-muted);">
        <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
      </p>
      <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Links</h1>
      <p class="text-sm mt-2" style="color: var(--text-muted);">Every link you own. Toggle to show on your public page.</p>
    </div>
    {#if data.user.handle}
      <a href={`/@${data.user.handle}`} target="_blank" rel="noopener" class="text-sm shrink-0 hover:opacity-70 transition-opacity" style="color: var(--text-muted);">View public →</a>
    {/if}
  </header>

  <div class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
    <table class="w-full text-sm">
      <thead>
        <tr style="border-bottom: 1px solid var(--border);">
          <th class="w-6 py-3"></th>
          <th class="text-left py-3 pl-1 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Link</th>
          <th class="text-left py-3 pr-4 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Title</th>
          <th class="w-24 text-left py-3 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">On page</th>
          <th class="w-16 text-right py-3 pr-2 font-normal text-xs uppercase tracking-wide" style="color: var(--text-muted);">Clicks</th>
          <th class="w-10 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {#each links as l (l.id)}
          <tr
            draggable={isPublic(l)}
            on:dragstart={(e) => onDragStart(e, l)}
            on:dragover={(e) => onDragOver(e, l)}
            on:dragend={onDragEnd}
            on:drop={(e) => onDrop(e, l)}
            class="group"
            style="border-top: 1px solid var(--border); opacity: {dragId === l.id ? '0.35' : '1'}; background: {dragOverId === l.id && dragId !== l.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'}; transition: opacity 120ms ease, background 120ms ease;"
          >
            <td class="pl-2 align-middle text-center" style="cursor: {isPublic(l) ? 'grab' : 'default'};" title={isPublic(l) ? 'Drag to reorder on public page' : ''}>
              {#if isPublic(l)}
                <svg class="w-3.5 h-3.5 mx-auto opacity-30 group-hover:opacity-70 transition-opacity" viewBox="0 0 24 24" fill="currentColor" style="color: var(--text-muted);" aria-hidden="true">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              {/if}
            </td>

            <td class="py-2.5 pr-4 pl-1 align-middle min-w-0">
              <button
                on:click={() => copy(l.id, l.shortURL)}
                class="flex items-baseline gap-1.5 hover:opacity-80 transition-opacity"
                style="background: transparent; border: none; cursor: pointer; padding: 0;"
                title="Copy short link"
              >
                <span class="text-xs font-mono" style="color: var(--text-muted);">iksi.app/</span>
                <span class="text-xs font-mono font-medium" style="color: var(--text-primary);">{l.shortURL}</span>
                {#if copiedId === l.id}
                  <span class="text-[10px]" style="color: var(--accent);">copied</span>
                {/if}
              </button>
              {#if l.originalURL}
                <a href={l.originalURL} target="_blank" rel="noopener"
                   class="block text-xs mt-0.5 truncate hover:opacity-70 transition-opacity max-w-[16rem]"
                   style="color: var(--text-muted);"
                   title={l.originalURL}>{hostOf(l.originalURL)}</a>
              {:else}
                <span class="block text-xs mt-0.5 italic" style="color: var(--text-muted); opacity: 0.6;">destination unavailable</span>
              {/if}
              {#if verdictLabel(l.safeVerdict)}
                <span class="text-[10px]" style="color: var(--error);">{verdictLabel(l.safeVerdict)}</span>
              {/if}
            </td>

            <td class="py-2.5 pr-4 align-middle">
              {#if editingTitleId === l.id}
                <input
                  type="text"
                  value={l.profileRow?.title ?? ''}
                  maxlength="80"
                  autofocus
                  on:blur={(e) => saveTitle(l, e.currentTarget.value)}
                  on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { editingTitleId = null; } }}
                  class="w-full px-2 py-1 text-sm rounded outline-none"
                  style="background: var(--bg); border: 1px solid var(--accent); color: var(--text-primary);"
                />
              {:else}
                <button
                  on:click={() => (editingTitleId = l.id)}
                  class="w-full text-left text-sm truncate px-2 py-1 -mx-2 rounded hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] transition-colors"
                  style="background: transparent; border: none; cursor: text; color: {l.profileRow?.title ? 'var(--text-primary)' : 'var(--text-muted)'};"
                >{l.profileRow?.title || 'Add a title…'}</button>
              {/if}
            </td>

            <td class="py-2.5 pr-4 align-middle">
              <button
                role="switch"
                aria-checked={l.profileRow?.enabled ?? false}
                aria-label={l.profileRow?.enabled ? 'Remove from public page' : 'Show on public page'}
                on:click={() => togglePublish(l)}
                class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                style="background: {l.profileRow?.enabled ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
              >
                <span class="inline-block w-4 h-4 rounded-full transition-transform"
                      style="background: white; transform: translateX({l.profileRow?.enabled ? '18px' : '2px'});"></span>
              </button>
            </td>

            <td class="py-2.5 pr-2 align-middle text-right">
              <div class="text-sm tabular-nums" style="color: var(--text-primary);">{l.clickCount.toLocaleString()}</div>
              <div class="text-[10px]" style="color: var(--text-muted);">{relDate(l.createdAt)}</div>
            </td>

            <td class="py-2.5 pr-2 align-middle text-right">
              <button
                on:click={() => del(l)}
                aria-label="Delete link"
                title="Delete link"
                class="p-1 opacity-30 group-hover:opacity-100 transition-opacity"
                style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                </svg>
              </button>
            </td>
          </tr>
        {/each}

        <!-- Add-row: at the bottom, always. Paste URL, optional title, toggle to publish. -->
        <tr style="border-top: 1px solid var(--border);">
          <td class="pl-2 align-middle text-center">
            <span class="text-sm leading-none" style="color: var(--text-muted); opacity: 0.5;">+</span>
          </td>
          <td class="py-2 pr-4 pl-1 align-middle">
            <input
              type="url"
              bind:value={newURL}
              placeholder="https://example.com/…"
              maxlength="2048"
              on:keydown={(e) => { if (e.key === 'Enter') add(); }}
              class="w-full px-0 py-1.5 text-sm outline-none bg-transparent"
              style="color: var(--text-primary); border: none;"
            />
          </td>
          <td class="py-2 pr-4 align-middle">
            <input
              type="text"
              bind:value={newTitle}
              placeholder="Title (defaults to site name)"
              maxlength="80"
              on:keydown={(e) => { if (e.key === 'Enter') add(); }}
              class="w-full px-0 py-1.5 text-sm outline-none bg-transparent"
              style="color: var(--text-primary); border: none;"
            />
          </td>
          <td class="py-2 pr-4 align-middle">
            <button
              role="switch"
              aria-checked={newPublish}
              aria-label={newPublish ? 'Will publish' : 'Will not publish'}
              on:click={() => (newPublish = !newPublish)}
              class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
              style="background: {newPublish ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
            >
              <span class="inline-block w-4 h-4 rounded-full transition-transform"
                    style="background: white; transform: translateX({newPublish ? '18px' : '2px'});"></span>
            </button>
          </td>
          <td class="py-2 pr-2 align-middle text-right" colspan="2">
            <button
              on:click={add}
              disabled={!canAdd}
              class="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style="color: var(--accent); background: transparent; border: none; cursor: pointer; padding: 0;"
            >{adding ? 'Adding…' : 'Add'}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  {#if addError}
    <p class="text-xs" style="color: var(--error);">{addError}</p>
  {/if}
</section>
