<script lang="ts">
  import { tick } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import LinkSettings from '#lib/components/links/LinkSettings.svelte';
  import type { LinkSettingsData } from '#lib/rules-form.js';

  export let data;

  type Link = {
    id: number;
    shortURL: string;
    originalURL: string;
    clickCount: number;
    createdAt: string | Date;
    safeVerdict: string | null;
    profileRow: { id: number; title: string; enabled: boolean; position: number } | null;
    settings?: LinkSettingsData;
    // Set true on optimistic rows while the server call is in flight; used to
    // dim the row visually. Never persisted by the loader.
    pending?: boolean;
  };

  // Negative counter so temp IDs never collide with real DB IDs.
  let _tempIdCounter = -1;
  const nextTempId = () => _tempIdCounter--;

  let links: Link[] = [...data.links];
  let _linksRef = data.links;
  $: if (data.links !== _linksRef) {
    _linksRef = data.links;
    links = [...data.links];
  }

  let copiedId: number | null = null;

  // --- Per-link settings sheet (one open at a time) ---
  // The sheet is a modal dialog: focus moves into it on open, Tab stays
  // inside it, Escape or a backdrop click closes it, and focus returns to
  // the gear that opened it.
  let sheetId: number | null = null;
  let sheetEl: HTMLElement | undefined;
  let sheetTrigger: HTMLElement | null = null;
  $: sheetLink = sheetId === null ? null : links.find((l) => l.id === sheetId && l.settings) ?? null;

  async function openSheet(l: Link, e: MouseEvent) {
    sheetTrigger = e.currentTarget as HTMLElement;
    sheetId = l.id;
    await tick();
    sheetEl?.focus();
  }
  async function closeSheet() {
    if (sheetId === null) return;
    sheetId = null;
    await tick();
    sheetTrigger?.focus();
    sheetTrigger = null;
  }
  function onWindowKeydown(e: KeyboardEvent) {
    if (sheetId === null || e.key !== 'Escape') return;
    e.preventDefault();
    closeSheet();
  }
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !sheetEl) return;
    const items = [...sheetEl.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheetEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onSettingsSaved(id: number, s: LinkSettingsData) {
    links = links.map((l) => (l.id === id ? { ...l, originalURL: s.destination, settings: s } : l));
    toast('Settings saved');
  }

  function states(s: LinkSettingsData) {
    return [
      { label: 'Password', on: s.hasPassword },
      { label: 'Expiry', on: s.expiresAt !== null || s.maxClicks !== null },
      { label: 'Rules', on: s.rules.length > 0 }
    ];
  }

  // --- Lightweight toast (single message, auto-dismiss) ---
  let toastMessage: string | null = null;
  let toastKind: 'success' | 'error' = 'success';
  let _toastTimer: ReturnType<typeof setTimeout> | null = null;
  function toast(message: string, kind: 'success' | 'error' = 'success') {
    toastMessage = message;
    toastKind = kind;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { toastMessage = null; }, 2200);
  }

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
      toast('Copied to clipboard');
    } catch {
      toast('Could not copy', 'error');
    }
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
      toast(body.error || 'Something went wrong', 'error');
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
      toast(nextEnabled ? 'Published to your page' : 'Removed from your page');
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
        toast('Removed from your page');
      } else {
        toast('Could not update', 'error');
      }
      return;
    }
    if (link.profileRow && link.profileRow.title === title) return;
    const enabled = link.profileRow?.enabled ?? false;
    const row = await apiUpsertRow(link, title, enabled);
    if (row) {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
      toast('Title saved');
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
      toast('Could not delete link', 'error');
    } else {
      toast('Link deleted');
    }
  }

  // --- Add link ---
  let newURL = '';
  let newTitle = '';
  let newPublish = true;
  let addError = '';

  function isValidUrl(s: string) {
    if (!s) return false;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return !!u.hostname && u.hostname.includes('.');
    } catch { return false; }
  }
  // Form stays enabled during in-flight adds — the optimistic prepend
  // makes the operation feel instant, and the user can queue another add
  // right away.
  $: canAdd = isValidUrl(newURL);

  async function add() {
    if (!canAdd) return;

    // Snapshot form values, clear the form immediately so the user can
    // keep adding.
    const url = newURL.trim();
    const typedTitle = newTitle.trim();
    const wantsPublic = newPublish;
    newURL = '';
    newTitle = '';
    addError = '';

    // Prepend an optimistic row so it appears in the list instantly.
    // Muted (pending) until the server confirms.
    const tempId = nextTempId();
    const optimisticTitle = typedTitle || hostOf(url) || '';
    const shouldPublish = wantsPublic || typedTitle.length > 0;
    const optimistic: Link = {
      id: tempId,
      shortURL: '···',
      originalURL: url,
      clickCount: 0,
      createdAt: new Date().toISOString(),
      safeVerdict: null,
      profileRow: shouldPublish && optimisticTitle
        ? { id: tempId, title: optimisticTitle, enabled: wantsPublic, position: -1 }
        : null,
      pending: true
    };
    links = [optimistic, ...links];

    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longURL: url, customURL: '' })
      });
      const body = await res.json();
      if (!res.ok) {
        // Roll back the optimistic entry, restore the form so user can retry.
        links = links.filter((l) => l.id !== tempId);
        newURL = url;
        newTitle = typedTitle;
        addError = body.error || 'Could not shorten.';
        toast(body.error || 'Could not shorten', 'error');
        return;
      }

      let addedLink: Link | null = body.link ? { ...body.link, profileRow: null } : null;
      let wasDedupe = false;
      if (!addedLink && body.shortURL) {
        await invalidateAll();
        const fresh = data.links.find((l: any) => l.shortURL === body.shortURL);
        addedLink = fresh ?? null;
        wasDedupe = true;
      }

      if (!addedLink) {
        links = links.filter((l) => l.id !== tempId);
        toast('Something went wrong', 'error');
        return;
      }

      // Replace the optimistic entry with the real link data — keep pending
      // true if we still have an upsert to do.
      const needsUpsert = optimisticTitle && (wantsPublic || typedTitle.length > 0);
      links = links.map((l) =>
        l.id === tempId
          ? { ...addedLink!, profileRow: l.profileRow, pending: needsUpsert }
          : l
      );

      if (needsUpsert) {
        const row = await apiUpsertRow(addedLink, optimisticTitle, wantsPublic);
        links = links.map((l) =>
          l.id === addedLink!.id
            ? { ...l, profileRow: row ?? l.profileRow, pending: false }
            : l
        );
      }

      toast(wasDedupe ? 'Already had this — updated' : 'Link added');
    } catch {
      // Roll back the optimistic entry on network error.
      links = links.filter((l) => l.id !== tempId);
      newURL = url;
      newTitle = typedTitle;
      addError = 'Network error.';
      toast('Network error', 'error');
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
    if (!res.ok) {
      invalidateAll();
      toast('Could not save order', 'error');
    } else {
      toast('Order updated');
    }
  }
</script>


<svelte:head><title>Links — iksi</title></svelte:head>
<svelte:window on:keydown={onWindowKeydown} />

{#if toastMessage}
  <div class="toast-wrap">
    <div role="status" aria-live="polite" class="toast toast-anim" class:error={toastKind === 'error'}>
      <span class="d-dot on" class:err-dot={toastKind === 'error'}></span>
      <span>{toastMessage}</span>
    </div>
  </div>
{/if}

<section class="w-full max-w-2xl mx-auto d-scope" inert={sheetId !== null}>
  <header class="mb-10">
    <p class="text-sm mb-8" style="color: var(--text-muted);">
      <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
    </p>
    <div class="flex items-baseline justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Links</h1>
        <p class="d-desc mt-2">Everything you've shortened. Switch one on to show it on your public page.</p>
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

  <table class="links w-full">
    <thead>
      <tr>
        <th class="handle-col"><span class="sr-only">Reorder</span></th>
        <th class="text-left">Link</th>
        <th class="toggle-col">On page</th>
        <th class="clicks-col">Clicks</th>
        <th class="icon-col"><span class="sr-only">Settings</span></th>
        <th class="icon-col"><span class="sr-only">Delete</span></th>
      </tr>
    </thead>
    <tbody>
      {#each links as l (l.id)}
        <tr
          draggable={isPublic(l) && !l.pending}
          on:dragstart={(e) => onDragStart(e, l)}
          on:dragover={(e) => onDragOver(e, l)}
          on:dragend={onDragEnd}
          on:drop={(e) => onDrop(e, l)}
          class="row group"
          class:drop-target={dragOverId === l.id && dragId !== l.id}
          style="opacity: {dragId === l.id ? '0.35' : l.pending ? '0.5' : '1'};"
        >
          <!-- Drag handle (public only) -->
          <td class="handle-col" style="cursor: {isPublic(l) ? 'grab' : 'default'};">
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
          <td class="link-col">
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
                  aria-label="Title"
                  on:blur={(e) => saveTitle(l, e.currentTarget.value)}
                  on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  class="title-input"
                  class:untitled={!l.profileRow?.title}
                />
                <div class="meta">
                  <button on:click={() => copy(l.id, l.shortURL)} class="short" title="Copy short link"
                  >{copiedId === l.id ? 'copied' : `iksi.app/${l.shortURL}`}</button>
                  {#if l.originalURL}
                    <span class="sep" aria-hidden="true">·</span>
                    <span class="truncate" title={l.originalURL}>{hostOf(l.originalURL)}</span>
                  {/if}
                  {#if verdictLabel(l.safeVerdict)}
                    <span class="sep" aria-hidden="true">·</span>
                    <span style="color: var(--error);">{verdictLabel(l.safeVerdict)}</span>
                  {/if}
                  {#if l.settings}
                    <span class="dots" role="list" aria-label="Link state">
                      {#each states(l.settings) as st}
                        <span role="listitem" class="d-dot" class:on={st.on} title={`${st.label}: ${st.on ? 'on' : 'off'}`}>
                          <span class="sr-only">{st.label} {st.on ? 'on' : 'off'}</span>
                        </span>
                      {/each}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </td>

          <!-- On page -->
          <td class="toggle-col">
            <button
              type="button"
              role="switch"
              class="d-switch"
              aria-checked={l.profileRow?.enabled ?? false}
              aria-label={l.profileRow?.enabled ? 'Remove from public page' : 'Show on public page'}
              on:click={() => togglePublish(l)}
            ></button>
          </td>

          <!-- Clicks -->
          <td class="clicks-col">
            <span class="d-readout" title={relDate(l.createdAt)}>{fmtClicks(l.clickCount)}</span>
          </td>

          <!-- Settings -->
          <td class="icon-col">
            {#if l.settings}
              <button
                type="button"
                class="d-icon"
                on:click={(e) => openSheet(l, e)}
                aria-label="Link settings"
                aria-haspopup="dialog"
                aria-expanded={sheetId === l.id}
                title="Link settings"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            {/if}
          </td>

          <!-- Delete -->
          <td class="icon-col">
            <button type="button" on:click={() => del(l)} aria-label="Delete link" title="Delete link" class="d-icon delete">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
              </svg>
            </button>
          </td>
        </tr>
      {/each}

      <!-- Add row -->
      <tr class="row add-row">
        <td class="handle-col">
          <span class="text-sm" style="color: var(--text-muted); opacity: 0.5;" aria-hidden="true">+</span>
        </td>
        <td class="link-col">
          <div class="flex items-center gap-3">
            <!-- Spacer to align inputs with body-row favicons -->
            <div class="w-4 h-4 shrink-0" aria-hidden="true"></div>
            <div class="min-w-0 flex-1">
              <input
                type="url"
                bind:value={newURL}
                placeholder="Paste a URL…"
                maxlength="2048"
                aria-label="New link URL"
                on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                class="title-input"
              />
              <input
                type="text"
                bind:value={newTitle}
                placeholder="Title (optional)"
                maxlength="80"
                aria-label="New link title"
                on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                class="title-input sub"
              />
            </div>
          </div>
        </td>
        <td class="toggle-col">
          <button
            type="button"
            role="switch"
            class="d-switch"
            aria-checked={newPublish}
            aria-label={newPublish ? 'Will publish' : 'Will not publish'}
            on:click={() => (newPublish = !newPublish)}
          ></button>
        </td>
        <td class="add-col" colspan="3">
          <button type="button" on:click={add} disabled={!canAdd} class="d-btn d-btn-primary">Add link</button>
        </td>
      </tr>
    </tbody>
  </table>

  <p class="add-error" role={addError ? 'alert' : undefined}>{addError}</p>
</section>

{#if sheetLink && sheetLink.settings}
  <div class="sheet-root d-scope">
    <!-- Pointer-only shortcut; Escape and the close button cover keyboards. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="backdrop" data-testid="sheet-backdrop" on:click={closeSheet}></div>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      aria-describedby="sheet-sub"
      tabindex="-1"
      bind:this={sheetEl}
      on:keydown={trapFocus}
    >
      <header class="sheet-head">
        <div class="min-w-0">
          <h2 id="sheet-title" class="d-title">Link settings</h2>
          <p id="sheet-sub" class="sheet-sub">iksi.app/{sheetLink.shortURL}</p>
        </div>
        <button type="button" class="d-icon" aria-label="Close settings" on:click={closeSheet}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="sheet-body">
        {#key sheetLink.id}
          <LinkSettings id={sheetLink.id} settings={sheetLink.settings} on:saved={(e) => onSettingsSaved(sheetLink.id, e.detail)} />
        {/key}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Links table: flat, hairline rows, no outer box. */
  .links {
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 14px;
  }
  .links th {
    height: 36px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 400;
    text-align: center;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  .links th.text-left { text-align: left; padding-left: 0; }
  .links td {
    padding: 12px 8px;
    vertical-align: middle;
  }
  .row { border-bottom: 1px solid var(--border); }
  .row.drop-target { background-color: color-mix(in srgb, var(--accent) 8%, transparent); }
  .handle-col { width: 24px; padding-left: 0 !important; padding-right: 0 !important; }
  .link-col { padding-left: 0 !important; }
  .toggle-col { width: 76px; text-align: center; }
  .toggle-col .d-switch { vertical-align: middle; }
  .clicks-col { width: 64px; text-align: right !important; }
  .links td.clicks-col { padding-right: 12px; }
  .icon-col { width: 40px; padding-left: 0 !important; padding-right: 0 !important; text-align: center; }
  .add-col { text-align: right; padding-right: 0 !important; }

  .title-input {
    display: block;
    width: calc(100% + 16px);
    margin: 0 -8px;
    padding: 4px 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    background-color: transparent;
    border: none;
    border-radius: 4px;
    outline: none;
    text-overflow: ellipsis;
  }
  .title-input.untitled,
  .title-input.sub { color: var(--text-muted); }
  .title-input.sub { font-size: 13px; font-weight: 400; }
  .title-input::placeholder { color: var(--text-muted); opacity: 0.6; }
  .title-input:hover:not(:focus) { background-color: color-mix(in srgb, var(--text-primary) 4%, transparent); }
  .title-input:focus { background-color: color-mix(in srgb, var(--text-primary) 6%, transparent); }
  .title-input:focus-visible { outline: 1px solid var(--border-focus); outline-offset: 0; }

  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin-top: 2px;
    font-size: 12px;
    white-space: nowrap;
    color: var(--text-muted);
  }
  .short {
    flex: none;
    padding: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
  }
  .short:hover { color: var(--text-primary); }
  .sep { opacity: 0.4; }
  .dots {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    margin-left: 4px;
  }

  .d-icon.delete { opacity: 0; }
  .row:hover .d-icon.delete,
  .d-icon.delete:focus-visible { opacity: 1; }
  .d-icon.delete:hover { color: var(--error) !important; }
  @media (hover: none) {
    .d-icon.delete { opacity: 1; }
  }

  .add-row { border-bottom: none; }
  .add-error {
    min-height: 18px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--error);
  }

  @media (max-width: 639px) {
    .handle-col { display: none; }
    .toggle-col { width: 52px; }
    .clicks-col { width: 48px; }
    .links td.clicks-col { padding-right: 4px; }
    .icon-col { width: 44px; }
    .add-col .d-btn { padding: 0 12px; }
  }

  /* Settings sheet */
  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 90;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background-color: rgb(0 0 0 / 0.55);
    animation: backdrop-in 200ms var(--ease-out);
  }
  :global([data-theme="light"]) .backdrop { background-color: rgb(0 0 0 / 0.2); }
  .sheet {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    width: 480px;
    max-width: 100%;
    background-color: var(--bg);
    border-left: 1px solid var(--border);
    outline: none;
    animation: sheet-in 200ms var(--ease-out);
  }
  .sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 20px 20px 24px;
    border-bottom: 1px solid var(--border);
  }
  .sheet-head .d-icon { margin-top: -6px; }
  .sheet-sub {
    margin-top: 2px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--text-muted);
  }
  .sheet-body {
    --ls-pad: 24px;
    --d-label: 136px;
    /* Save row: 16px padding above and below a control, plus its hairline. */
    --ls-footer-h: calc(var(--d-ctl) + 33px);
    flex: 1;
    min-height: 0;
    padding: 4px 24px calc(var(--ls-footer-h) + 24px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  /* The Save row is pinned to the sheet's bottom edge, outside the scroll
     flow; the padding above keeps the last control clear of it. */
  .sheet-body :global(.ls-footer) {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--ls-footer-h);
    margin: 0;
  }
  @keyframes sheet-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  @keyframes backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @media (max-width: 639px) {
    .sheet { width: 100%; border-left: none; }
    .sheet-head { padding: 12px 8px 12px 16px; }
    .sheet-head .d-icon { margin-top: -10px; }
    .sheet-body { --ls-pad: 16px; padding: 0 16px calc(var(--ls-footer-h) + 24px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .backdrop { animation: none; }
  }

  /* Toast: bottom centre so it never sits on the sheet's header. */
  .toast-wrap {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 24px;
    z-index: 100;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }
  .toast {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    max-width: min(90vw, 26rem);
    padding: 8px 14px;
    font-size: 13px;
    color: var(--text-primary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .toast.error { border-color: var(--error); }
  .err-dot { background-color: var(--error) !important; }
  .toast-anim { animation: toast-in 180ms var(--ease-out); }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast-anim { animation: none; }
  }
</style>
