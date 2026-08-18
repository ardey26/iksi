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

  $: publicLinks = links.filter((l) => l.profileRow?.enabled);
  $: privateLinks = links.filter((l) => !l.profileRow?.enabled);

  let copiedId: number | null = null;

  function hostOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u; }
  }
  function faviconOf(u: string) {
    const host = hostOf(u);
    if (!host || !host.includes('.')) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
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
      if (!res.ok) {
        addError = body.error || 'Could not shorten.';
        return;
      }

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

  // --- Drag reorder (public links only) ---
  let dragId: number | null = null;
  let dragOverId: number | null = null;

  function onDragStart(e: DragEvent, l: Link) {
    dragId = l.id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(l.id));
    }
  }
  function onDragOver(e: DragEvent, l: Link) {
    if (dragId === null) return;
    e.preventDefault();
    dragOverId = l.id;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }
  function onDragEnd() { dragId = null; dragOverId = null; }
  async function onDrop(e: DragEvent, target: Link) {
    e.preventDefault();
    const from = dragId;
    dragId = null; dragOverId = null;
    if (from === null || from === target.id) return;

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

<section class="w-full max-w-2xl mx-auto space-y-10">
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

  <!-- Add a link -->
  <div class="rounded-xl p-5 space-y-4"
       style="background: var(--surface); border: 1px solid var(--border);">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-sm font-medium" style="color: var(--text-primary);">Add a link</h2>
      {#if addError}<span class="text-xs" style="color: var(--error);">{addError}</span>{/if}
    </div>
    <input
      type="url"
      bind:value={newURL}
      placeholder="Paste any URL — https://example.com/…"
      maxlength="2048"
      on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
      class="w-full px-3 py-2.5 text-base rounded-lg outline-none transition-colors"
      style="background: var(--bg); border: 1px solid {newURL && !isValidUrl(newURL) ? 'var(--error)' : isValidUrl(newURL) ? 'var(--accent)' : 'var(--border)'}; color: var(--text-primary);"
    />
    <div class="flex items-center gap-3">
      <input
        type="text"
        bind:value={newTitle}
        placeholder="Title (optional — used on your public page)"
        maxlength="80"
        on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        class="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg outline-none transition-colors"
        style="background: var(--bg); border: 1px solid var(--border); color: var(--text-primary);"
      />
      <label class="flex items-center gap-2 shrink-0 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={newPublish}
          on:click={() => (newPublish = !newPublish)}
          class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
          style="background: {newPublish ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
        >
          <span class="inline-block w-4 h-4 rounded-full transition-transform"
                style="background: white; transform: translateX({newPublish ? '18px' : '2px'});"></span>
        </button>
        <span class="text-xs" style="color: var(--text-muted);">Publish now</span>
      </label>
      <button
        on:click={add}
        disabled={!canAdd}
        class="px-4 py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer;"
      >{adding ? 'Adding…' : 'Add'}</button>
    </div>
  </div>

  <!-- On your page -->
  {#if publicLinks.length > 0}
    <div class="space-y-3">
      <div class="flex items-baseline justify-between px-1">
        <h2 class="text-xs uppercase tracking-wide font-medium" style="color: var(--text-muted);">
          On your page
          <span class="ml-1" style="color: var(--text-primary);">{publicLinks.length}</span>
        </h2>
        <span class="text-[10px]" style="color: var(--text-muted); opacity: 0.7;">Drag to reorder</span>
      </div>
      <ul class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
        {#each publicLinks as l (l.id)}
          <li
            draggable="true"
            on:dragstart={(e) => onDragStart(e, l)}
            on:dragover={(e) => onDragOver(e, l)}
            on:dragend={onDragEnd}
            on:drop={(e) => onDrop(e, l)}
            class="group relative flex items-center gap-3 px-4 py-3.5 transition-all"
            style="border-top: 1px solid var(--border); opacity: {dragId === l.id ? '0.35' : '1'}; background: {dragOverId === l.id && dragId !== l.id ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent'}; cursor: grab;"
          >
            <!-- Drag handle -->
            <svg class="w-3.5 h-3.5 opacity-25 group-hover:opacity-60 transition-opacity shrink-0"
                 viewBox="0 0 24 24" fill="currentColor" style="color: var(--text-muted);" aria-hidden="true">
              <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
            </svg>

            <!-- Favicon -->
            <div class="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                 style="background: var(--bg); border: 1px solid var(--border);">
              {#if faviconOf(l.originalURL)}
                <img src={faviconOf(l.originalURL)} alt="" class="w-4 h-4" loading="lazy"
                     on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
              {:else}
                <span class="text-xs" style="color: var(--text-muted);">·</span>
              {/if}
            </div>

            <!-- Title + meta -->
            <div class="min-w-0 flex-1">
              <input
                type="text"
                value={l.profileRow?.title ?? ''}
                placeholder="Untitled"
                maxlength="80"
                on:blur={(e) => saveTitle(l, e.currentTarget.value)}
                on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                class="w-full text-sm font-medium bg-transparent outline-none px-0 py-0 truncate title-input"
                style="color: var(--text-primary); border: none;"
              />
              <div class="flex items-center gap-1.5 mt-0.5 text-xs" style="color: var(--text-muted);">
                <button
                  on:click|stopPropagation={() => copy(l.id, l.shortURL)}
                  class="font-mono hover:opacity-70 transition-opacity"
                  style="background: transparent; border: none; cursor: pointer; padding: 0; color: inherit;"
                  title="Copy short link"
                >{copiedId === l.id ? 'copied' : `iksi.app/${l.shortURL}`}</button>
                {#if l.originalURL}
                  <span style="opacity: 0.5;">·</span>
                  <a href={l.originalURL} target="_blank" rel="noopener"
                     class="truncate hover:opacity-70 transition-opacity" style="color: inherit;"
                     title={l.originalURL}>{hostOf(l.originalURL)}</a>
                {/if}
                {#if verdictLabel(l.safeVerdict)}
                  <span style="opacity: 0.5;">·</span>
                  <span style="color: var(--error);">{verdictLabel(l.safeVerdict)}</span>
                {/if}
              </div>
            </div>

            <!-- Clicks -->
            <div class="text-right shrink-0 tabular-nums" style="color: var(--text-muted);">
              <div class="text-sm" style="color: var(--text-primary);">{fmtClicks(l.clickCount)}</div>
              <div class="text-[10px] mt-0.5">{relDate(l.createdAt)}</div>
            </div>

            <!-- Toggle -->
            <button
              role="switch"
              aria-checked={true}
              aria-label="Remove from public page"
              on:click|stopPropagation={() => togglePublish(l)}
              class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors shrink-0"
              style="background: var(--accent); border: none; cursor: pointer; padding: 0;"
            >
              <span class="inline-block w-4 h-4 rounded-full" style="background: white; transform: translateX(18px);"></span>
            </button>

            <!-- Delete -->
            <button
              on:click|stopPropagation={() => del(l)}
              aria-label="Delete link"
              title="Delete link"
              class="p-1 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity shrink-0"
              style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
              </svg>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <!-- Not published -->
  {#if privateLinks.length > 0}
    <div class="space-y-3">
      <h2 class="text-xs uppercase tracking-wide font-medium px-1" style="color: var(--text-muted);">
        Not on your page
        <span class="ml-1" style="color: var(--text-primary);">{privateLinks.length}</span>
      </h2>
      <ul class="rounded-xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
        {#each privateLinks as l (l.id)}
          <li class="group relative flex items-center gap-3 px-4 py-3.5"
              style="border-top: 1px solid var(--border);">
            <!-- Spacer where drag handle sits for public rows -->
            <div class="w-3.5 shrink-0"></div>

            <div class="w-8 h-8 rounded-md flex items-center justify-center shrink-0 overflow-hidden"
                 style="background: var(--bg); border: 1px solid var(--border); opacity: 0.7;">
              {#if faviconOf(l.originalURL)}
                <img src={faviconOf(l.originalURL)} alt="" class="w-4 h-4" loading="lazy"
                     on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
              {:else}
                <span class="text-xs" style="color: var(--text-muted);">·</span>
              {/if}
            </div>

            <div class="min-w-0 flex-1">
              <input
                type="text"
                value={l.profileRow?.title ?? ''}
                placeholder="Add a title…"
                maxlength="80"
                on:blur={(e) => saveTitle(l, e.currentTarget.value)}
                on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                class="w-full text-sm font-medium bg-transparent outline-none px-0 py-0 truncate title-input"
                style="color: {l.profileRow?.title ? 'var(--text-primary)' : 'var(--text-muted)'}; border: none;"
              />
              <div class="flex items-center gap-1.5 mt-0.5 text-xs" style="color: var(--text-muted);">
                <button
                  on:click={() => copy(l.id, l.shortURL)}
                  class="font-mono hover:opacity-70 transition-opacity"
                  style="background: transparent; border: none; cursor: pointer; padding: 0; color: inherit;"
                  title="Copy short link"
                >{copiedId === l.id ? 'copied' : `iksi.app/${l.shortURL}`}</button>
                {#if l.originalURL}
                  <span style="opacity: 0.5;">·</span>
                  <a href={l.originalURL} target="_blank" rel="noopener"
                     class="truncate hover:opacity-70 transition-opacity" style="color: inherit;"
                     title={l.originalURL}>{hostOf(l.originalURL)}</a>
                {/if}
                {#if verdictLabel(l.safeVerdict)}
                  <span style="opacity: 0.5;">·</span>
                  <span style="color: var(--error);">{verdictLabel(l.safeVerdict)}</span>
                {/if}
              </div>
            </div>

            <div class="text-right shrink-0 tabular-nums" style="color: var(--text-muted);">
              <div class="text-sm" style="color: var(--text-primary);">{fmtClicks(l.clickCount)}</div>
              <div class="text-[10px] mt-0.5">{relDate(l.createdAt)}</div>
            </div>

            <button
              role="switch"
              aria-checked={false}
              aria-label="Show on public page"
              on:click={() => togglePublish(l)}
              class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors shrink-0"
              style="background: var(--border); border: none; cursor: pointer; padding: 0;"
            >
              <span class="inline-block w-4 h-4 rounded-full" style="background: white; transform: translateX(2px);"></span>
            </button>

            <button
              on:click={() => del(l)}
              aria-label="Delete link"
              title="Delete link"
              class="p-1 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity shrink-0"
              style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
              </svg>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if links.length === 0}
    <div class="rounded-xl py-16 text-center" style="background: var(--surface); border: 1px dashed var(--border);">
      <p class="text-sm" style="color: var(--text-muted);">Nothing here yet. Paste a URL above to get started.</p>
    </div>
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
