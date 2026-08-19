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

  let links: Link[] = [...data.links];
  let _linksRef = data.links;
  $: if (data.links !== _linksRef) {
    _linksRef = data.links;
    links = [...data.links];
  }

  let copiedId: number | null = null;

  function hostOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u; }
  }

  // Favicon URLs are memoized per-hostname so re-renders don't recompute
  // (and the browser's HTTP cache dedupes network requests for the same host).
  // sz=32 = 2x for a 16px display, retina-crisp without wasting bytes.
  const _faviconByHost = new Map<string, string | null>();
  function faviconOf(u: string): string | null {
    const host = hostOf(u);
    if (!host || !host.includes('.')) return null;
    const cached = _faviconByHost.get(host);
    if (cached !== undefined) return cached;
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
    _faviconByHost.set(host, url);
    return url;
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
  function fmtClicks(n: number) {
    if (n < 1000) return n.toString();
    if (n < 10000) return (n / 1000).toFixed(1) + 'k';
    if (n < 1000000) return Math.round(n / 1000) + 'k';
    return (n / 1000000).toFixed(1) + 'M';
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
    links = links.map((l) =>
      l.id === link.id
        ? { ...l, profileRow: { id: l.profileRow?.id ?? -1, position: l.profileRow?.position ?? Number.MAX_SAFE_INTEGER, title: currentTitle, enabled: nextEnabled } }
        : l
    );
    const row = await apiUpsertRow(link, currentTitle, nextEnabled);
    if (!row) {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: link.profileRow } : l));
    } else {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
    }
  }

  async function saveTitle(link: Link, newTitle: string) {
    const title = newTitle.trim();
    if (!title) {
      if (!link.profileRow) return;
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
    if (!confirm(`Delete iksi.app/${link.shortURL}?`)) return;
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

  // --- Add link ---
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
      if (!res.ok) { addError = body.error || 'Could not shorten.'; return; }

      let addedLink: Link | null = body.link ? { ...body.link, profileRow: null } : null;
      if (!addedLink && body.shortURL) {
        await invalidateAll();
        const fresh = data.links.find((l: any) => l.shortURL === body.shortURL);
        addedLink = fresh ?? null;
      } else if (addedLink) {
        links = [addedLink, ...links];
      }

      const wantsPublic = newPublish;
      const title = newTitle.trim() || hostOf(url) || addedLink?.shortURL || '';
      if (addedLink && title && (wantsPublic || newTitle.trim().length > 0)) {
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

  // --- Drag reorder (public rows only) ---
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
    const privateLinks = links.filter((l) => !isPublic(l));
    const fromIdx = publicLinks.findIndex((l) => l.id === from);
    const toIdx = publicLinks.findIndex((l) => l.id === target.id);
    if (fromIdx < 0 || toIdx < 0) return;

    const moving = publicLinks[fromIdx];
    const reordered = publicLinks.slice();
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moving);
    links = [...reordered, ...privateLinks];

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
  <header>
    <p class="text-sm mb-8" style="color: var(--text-muted);">
      <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
    </p>
    <div class="flex items-baseline justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Links</h1>
        <p class="text-sm mt-2" style="color: var(--text-muted);">Everything you've shortened. Toggle to show on your public page.</p>
      </div>
      {#if data.user.handle}
        <a href={`/@${data.user.handle}`} target="_blank" rel="noopener"
           class="text-sm shrink-0 hover:opacity-70 transition-opacity flex items-center gap-1"
           style="color: var(--text-muted);">
          View public
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/>
          </svg>
        </a>
      {/if}
    </div>
  </header>

  <div class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
    <table class="w-full text-sm">
      <thead>
        <tr style="background: color-mix(in srgb, var(--text-primary) 2%, transparent);">
          <th class="w-6"></th>
          <th class="text-left py-2.5 pr-3 font-medium text-[10px] uppercase tracking-wider" style="color: var(--text-muted);">Link</th>
          <th class="w-20 text-center whitespace-nowrap font-medium text-[10px] uppercase tracking-wider" style="color: var(--text-muted);">On page</th>
          <th class="w-16 text-right pr-3 font-medium text-[10px] uppercase tracking-wider" style="color: var(--text-muted);">Clicks</th>
          <th class="w-10 pr-2"></th>
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
            style="border-top: 1px solid var(--border); opacity: {dragId === l.id ? '0.35' : '1'}; background: {dragOverId === l.id && dragId !== l.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'};"
          >
            <!-- Drag handle (public only) -->
            <td class="w-6 pl-2 align-middle" style="cursor: {isPublic(l) ? 'grab' : 'default'};">
              {#if isPublic(l)}
                <svg class="w-3 h-3 opacity-25 group-hover:opacity-60 transition-opacity"
                     viewBox="0 0 24 24" fill="currentColor" style="color: var(--text-muted);" aria-hidden="true">
                  <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                </svg>
              {/if}
            </td>

            <!-- Favicon + title + meta -->
            <td class="py-3 pr-3 align-middle min-w-0">
              <div class="flex items-center gap-3 min-w-0">
                {#if faviconOf(l.originalURL)}
                  <img src={faviconOf(l.originalURL)} alt="" width="16" height="16"
                       class="shrink-0 rounded-sm" loading="lazy" decoding="async"
                       on:error={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                {:else}
                  <div class="w-4 h-4 shrink-0"></div>
                {/if}
                <div class="min-w-0 flex-1">
                  <input
                    type="text"
                    value={l.profileRow?.title ?? ''}
                    placeholder={isPublic(l) ? 'Untitled' : 'Add a title…'}
                    maxlength="80"
                    on:blur={(e) => saveTitle(l, e.currentTarget.value)}
                    on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    class="w-full text-sm font-medium bg-transparent outline-none px-0 py-0 truncate title-input"
                    style="color: {l.profileRow?.title ? 'var(--text-primary)' : 'var(--text-muted)'}; border: none;"
                  />
                  <div class="flex items-center gap-1.5 mt-0.5 text-xs truncate" style="color: var(--text-muted);">
                    <button on:click={() => copy(l.id, l.shortURL)}
                            class="font-mono hover:opacity-70 transition-opacity shrink-0"
                            style="background: transparent; border: none; cursor: pointer; padding: 0; color: inherit;"
                            title="Copy short link"
                    >{copiedId === l.id ? 'copied' : `iksi.app/${l.shortURL}`}</button>
                    {#if l.originalURL}
                      <span style="opacity: 0.4;">·</span>
                      <span class="truncate" title={l.originalURL}>{hostOf(l.originalURL)}</span>
                    {/if}
                    {#if verdictLabel(l.safeVerdict)}
                      <span style="opacity: 0.4;">·</span>
                      <span style="color: var(--error);">{verdictLabel(l.safeVerdict)}</span>
                    {/if}
                  </div>
                </div>
              </div>
            </td>

            <!-- Toggle -->
            <td class="w-20 text-center align-middle">
              <button
                role="switch"
                aria-checked={l.profileRow?.enabled ?? false}
                aria-label={l.profileRow?.enabled ? 'Remove from public page' : 'Show on public page'}
                on:click={() => togglePublish(l)}
                class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors align-middle"
                style="background: {l.profileRow?.enabled ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
              >
                <span class="inline-block w-4 h-4 rounded-full transition-transform"
                      style="background: white; transform: translateX({l.profileRow?.enabled ? '18px' : '2px'});"></span>
              </button>
            </td>

            <!-- Clicks -->
            <td class="w-16 text-right align-middle tabular-nums pr-3">
              <div class="text-sm" style="color: var(--text-primary);" title={relDate(l.createdAt)}>{fmtClicks(l.clickCount)}</div>
            </td>

            <!-- Delete -->
            <td class="w-10 pr-2 text-center align-middle">
              <button
                on:click={() => del(l)}
                aria-label="Delete link"
                title="Delete link"
                class="p-1 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity align-middle"
                style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                </svg>
              </button>
            </td>
          </tr>
        {/each}

        <!-- Add-row -->
        <tr style="border-top: 1px solid var(--border); background: color-mix(in srgb, var(--text-primary) 2%, transparent);">
          <td class="w-6 pl-2 align-middle text-center">
            <span class="text-sm" style="color: var(--text-muted); opacity: 0.5;">+</span>
          </td>
          <td class="py-3 pr-3 align-middle">
            <div class="flex items-center gap-3">
              <!-- Spacer to align inputs with body-row favicons -->
              <div class="w-4 h-4 shrink-0" aria-hidden="true"></div>
              <div class="min-w-0 flex-1 space-y-1">
                <input
                  type="url"
                  bind:value={newURL}
                  placeholder="Paste a URL…"
                  maxlength="2048"
                  on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                  class="w-full text-sm font-medium bg-transparent outline-none px-0 py-0 truncate title-input"
                  style="color: var(--text-primary); border: none;"
                />
                <input
                  type="text"
                  bind:value={newTitle}
                  placeholder="Title (optional)"
                  maxlength="80"
                  on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                  class="w-full text-xs bg-transparent outline-none px-0 py-0 truncate title-input"
                  style="color: var(--text-muted); border: none;"
                />
              </div>
            </div>
          </td>
          <td class="w-20 text-center align-middle">
            <button
              role="switch"
              aria-checked={newPublish}
              aria-label={newPublish ? 'Will publish' : 'Will not publish'}
              on:click={() => (newPublish = !newPublish)}
              class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors align-middle"
              style="background: {newPublish ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
            >
              <span class="inline-block w-4 h-4 rounded-full transition-transform"
                    style="background: white; transform: translateX({newPublish ? '18px' : '2px'});"></span>
            </button>
          </td>
          <td class="align-middle text-right pr-2" colspan="2">
            <button
              on:click={add}
              disabled={!canAdd}
              class="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer;"
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

<style>
  .title-input::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
  }
  .title-input:focus {
    box-shadow: 0 1px 0 0 var(--accent);
  }
</style>
