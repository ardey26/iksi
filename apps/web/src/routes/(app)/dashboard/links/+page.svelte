<script lang="ts">
  import { tick } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import LinkSettings from '#lib/components/links/LinkSettings.svelte';
  import OneTimeLinkForm from '#lib/components/links/OneTimeLinkForm.svelte';
  import type { LinkSettingsData } from '#lib/rules-form.js';
  import {
    Badge,
    Button,
    Container,
    DragHandle,
    EmptyState,
    Field,
    IconButton,
    Input,
    List,
    Logo,
    Monogram,
    PageHeader,
    Paper,
    Row,
    Section,
    Skeleton,
    SortableList,
    Stack,
    Switch,
    toast
  } from '#lib/ui/index.js';
  import { uid } from '#lib/ui/uid.js';
  import { displayUrl, formatCount, hostOf, relativeDate } from '#lib/format.js';
  import { ONE_TIME_TTL_DAYS } from '#lib/one-time.js';

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
    // Set for burn-after-reading links: no settings, never on the page, content never sent here.
    oneTime?: { kind: 'url' | 'text'; state: 'unopened' | 'opened' | 'expired' } | null;
    // Set true on optimistic rows while the server call is in flight; the row
    // is muted and its controls wait. Never persisted by the loader.
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

  const isPublic = (l: Link) => !l.oneTime && !!l.profileRow?.enabled;
  const time = (l: Link) => new Date(l.createdAt).getTime();
  const shortLabel = (l: Link) => `iksi.app/${l.shortURL}`;

  // Three groups: the page's links in their page order, the rest newest
  // first, and one-time links.
  $: onPage = links.filter(isPublic);
  $: others = links.filter((l) => !l.oneTime && !isPublic(l)).sort((a, b) => time(b) - time(a));
  $: oneTimes = links.filter((l) => l.oneTime);
  $: regularCount = onPage.length + others.length;

  const ONE_TIME_STATE = {
    unopened: { label: 'Unopened', variant: 'success' },
    opened: { label: 'Opened', variant: 'neutral' },
    expired: { label: 'Expired', variant: 'warning' }
  } as const;

  function states(s: LinkSettingsData) {
    return [
      s.hasPassword && 'Password',
      (s.expiresAt !== null || s.maxClicks !== null) && 'Expiry',
      s.rules.length > 0 && (s.rules.length === 1 ? '1 rule' : `${s.rules.length} rules`)
    ].filter(Boolean) as string[];
  }

  function verdictLabel(v: string | null | undefined) {
    if (!v || v === 'safe' || v === 'pending') return null;
    return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ').toLowerCase();
  }

  // Favicon URLs are memoized per host (and the browser's HTTP cache dedupes
  // requests for the same host). A host whose icon fails gets a monogram.
  const _faviconByHost = new Map<string, string | null>();
  let brokenHosts = new Set<string>();
  function faviconOf(u: string): string | null {
    const host = hostOf(u);
    if (!host || !host.includes('.') || brokenHosts.has(host)) return null;
    const cached = _faviconByHost.get(host);
    if (cached !== undefined) return cached;
    const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    _faviconByHost.set(host, url);
    return url;
  }
  function onFaviconError(u: string) {
    brokenHosts = new Set([...brokenHosts, hostOf(u)]);
  }

  async function copy(l: Link) {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/${l.shortURL}`);
      toast('Link copied', { variant: 'success' });
    } catch {
      toast('Could not copy', { variant: 'error' });
    }
  }

  const focusSoon = async (selector: string) => {
    await tick();
    document.querySelector<HTMLElement>(selector)?.focus();
  };

  // --- Settings sheet (one at a time) ---
  let sheetOpen = false;
  let sheetLinkId: number | null = null;
  let sheetOpener: HTMLElement | null = null;
  $: sheetLink = sheetLinkId === null ? null : links.find((l) => l.id === sheetLinkId && l.settings) ?? null;

  function openSheet(l: Link, e: MouseEvent) {
    sheetOpener = e.currentTarget as HTMLElement;
    sheetLinkId = l.id;
    sheetOpen = true;
  }
  // The page is inert while the sheet is open; focus goes back to the gear
  // once it is not.
  async function onSheetClose() {
    sheetOpen = false;
    await tick();
    if (sheetOpener?.isConnected) sheetOpener.focus({ preventScroll: true });
    sheetOpener = null;
  }

  function onSettingsSaved(id: number, s: LinkSettingsData) {
    links = links.map((l) => (l.id === id ? { ...l, originalURL: s.destination, settings: s } : l));
    toast('Settings saved', { variant: 'success' });
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
      toast(body.error || 'Something went wrong', { variant: 'error' });
      return null;
    }
    const body = await res.json();
    return body.row as { id: number; title: string; enabled: boolean; position: number };
  }

  /** Puts a link that just went on the page at the end of the page's links. */
  function toEndOfPage(id: number, next: Link) {
    const rest = links.filter((l) => l.id !== id);
    links = [...rest.filter(isPublic), next, ...rest.filter((l) => !isPublic(l))];
  }

  async function togglePublish(link: Link) {
    const currentTitle = link.profileRow?.title?.trim() || hostOf(link.originalURL) || link.shortURL;
    const nextEnabled = !(link.profileRow?.enabled ?? false);
    const optimistic = {
      ...link,
      profileRow: { id: link.profileRow?.id ?? -1, position: link.profileRow?.position ?? Number.MAX_SAFE_INTEGER, title: currentTitle, enabled: nextEnabled }
    };
    if (nextEnabled) toEndOfPage(link.id, optimistic);
    else links = links.map((l) => (l.id === link.id ? optimistic : l));
    // The row moved to the other list; its switch keeps the focus.
    focusSoon(`[data-switch="${link.id}"]`);
    const row = await apiUpsertRow(link, currentTitle, nextEnabled);
    if (!row) {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: link.profileRow } : l));
      focusSoon(`[data-switch="${link.id}"]`);
    } else {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
      toast(nextEnabled ? 'Published to your page' : 'Removed from your page', { variant: 'success' });
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
        toast('Removed from your page', { variant: 'success' });
      } else {
        toast('Could not update', { variant: 'error' });
      }
      return;
    }
    if (link.profileRow && link.profileRow.title === title) return;
    const enabled = link.profileRow?.enabled ?? false;
    const row = await apiUpsertRow(link, title, enabled);
    if (row) {
      links = links.map((l) => (l.id === link.id ? { ...l, profileRow: row } : l));
      toast('Title saved', { variant: 'success' });
    }
  }

  async function del(link: Link) {
    const prev = links;
    links = links.filter((l) => l.id !== link.id);
    const res = await fetch('/dashboard/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: link.id })
    });
    if (!res.ok) {
      links = prev;
      toast('Could not delete link', { variant: 'error' });
    } else {
      toast('Link deleted', { variant: 'success' });
    }
  }

  async function deleteFromSheet(link: Link) {
    sheetOpen = false;
    sheetOpener = null;
    await del(link);
    focusSoon('[data-act="new-url"]');
  }

  // One-time rows confirm a delete inline.
  let confirmingId: number | null = null;
  function askDelete(l: Link) {
    confirmingId = l.id;
    focusSoon(`[data-confirm-cancel="${l.id}"]`);
  }
  function keep(l: Link) {
    confirmingId = null;
    focusSoon(`[data-delete="${l.id}"]`);
  }
  function confirmDelete(l: Link) {
    confirmingId = null;
    del(l);
  }

  function onOneTimeCreated(e: CustomEvent<Record<string, unknown>>) {
    links = [{ ...(e.detail as unknown as Link), profileRow: null }, ...links];
    toast('One-time link created', { variant: 'success' });
  }

  // --- Add link ---
  const ids = { publish: uid('publish'), name: uid('name') };
  let newURL = '';
  let newTitle = '';
  let newPublish = true;
  let newName = '';
  let addError = '';
  // A free iksi.app/@handle/name the server offered for a taken custom name.
  let addSuggestion = '';
  // Editing the form means the offer no longer answers what is typed.
  $: newURL, newName, (addSuggestion = '');
  $: namePrefix = data.scopeCustomNames && data.user.handle ? `iksi.app/@${data.user.handle}/` : 'iksi.app/';

  function isValidUrl(s: string) {
    if (!s) return false;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return !!u.hostname && u.hostname.includes('.');
    } catch { return false; }
  }
  // The form stays enabled during in-flight adds: the optimistic row makes the
  // operation feel instant, and another add can be queued right away.
  $: nameOk = /^[A-Za-z0-9_-]{0,50}$/.test(newName.trim());
  $: canAdd = isValidUrl(newURL) && nameOk;
  $: nameError = addSuggestion ? 'That name is taken.' : nameOk ? '' : 'Names use letters, numbers, - and _, up to 50.';

  /** `name` overrides the typed custom name; the suggestion button passes the scoped one. */
  async function add(name: string = newName.trim()) {
    if (!canAdd) return;

    // Snapshot the form and clear it, so the next link can be typed.
    const url = newURL.trim();
    const typedTitle = newTitle.trim();
    const typedName = newName;
    const wantsPublic = newPublish;
    newURL = '';
    newTitle = '';
    newName = '';
    addError = '';

    // An optimistic row shows at once, muted until the server confirms.
    const tempId = nextTempId();
    const optimisticTitle = typedTitle || hostOf(url) || '';
    const shouldPublish = wantsPublic || typedTitle.length > 0;
    const optimistic: Link = {
      id: tempId,
      shortURL: '',
      originalURL: /^https?:\/\//i.test(url) ? url : `https://${url}`,
      clickCount: 0,
      createdAt: new Date().toISOString(),
      safeVerdict: null,
      profileRow: shouldPublish && optimisticTitle
        ? { id: tempId, title: optimisticTitle, enabled: wantsPublic, position: -1 }
        : null,
      pending: true
    };
    links = isPublic(optimistic)
      ? [...links.filter(isPublic), optimistic, ...links.filter((l) => !isPublic(l))]
      : [optimistic, ...links];

    let addedId: number | null = null;
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longURL: url, customURL: name })
      });
      const body = await res.json();
      if (!res.ok) {
        // Roll back the optimistic row and restore the form for a retry.
        links = links.filter((l) => l.id !== tempId);
        newURL = url;
        newTitle = typedTitle;
        newName = typedName;
        if (typeof body.suggestion === 'string') {
          // Set after the restore above, which would otherwise clear it.
          await tick();
          addSuggestion = body.suggestion;
          return;
        }
        addError = body.error || 'Could not shorten.';
        toast(body.error || 'Could not shorten', { variant: 'error' });
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
        toast('Something went wrong', { variant: 'error' });
        return;
      }

      addedId = addedLink.id;
      // Swap in the real link; it stays pending while the page row is saved.
      const needsUpsert = optimisticTitle && (wantsPublic || typedTitle.length > 0);
      links = links.map((l) =>
        l.id === tempId ? { ...addedLink!, profileRow: l.profileRow, pending: !!needsUpsert } : l
      );

      if (needsUpsert) {
        const row = await apiUpsertRow(addedLink, optimisticTitle, wantsPublic);
        links = links.map((l) =>
          l.id === addedLink!.id ? { ...l, profileRow: row ?? l.profileRow, pending: false } : l
        );
      }

      toast(wasDedupe ? 'Already had this, updated' : 'Link added', { variant: 'success' });
    } catch {
      // A link that was made stays; only its wait ends.
      links = links.filter((l) => l.id !== tempId).map((l) => (l.id === addedId ? { ...l, pending: false } : l));
      newURL = url;
      newTitle = typedTitle;
      newName = typedName;
      addError = 'Network error.';
      toast('Network error', { variant: 'error' });
    }
  }

  // --- Page order ---
  // SortableList has already moved the row; this saves the new order.
  async function onReorder(e: CustomEvent<{ ids: number[] }>) {
    const byId = new Map(links.map((l) => [l.id, l]));
    const reordered = e.detail.ids.map((id) => byId.get(id)!).filter(Boolean);
    links = [...reordered, ...links.filter((l) => !e.detail.ids.includes(l.id))];
    const orderedIds = reordered.map((l) => l.profileRow!.id);
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorderRows', orderedIds })
    }).catch(() => null);
    if (!res?.ok) {
      invalidateAll();
      toast('Could not save the order', { variant: 'error' });
    } else {
      toast('Order saved', { variant: 'success' });
    }
  }

  $: anyPending = links.some((l) => l.pending);
</script>

<svelte:head><title>Links — iksi</title></svelte:head>

{#snippet leading(l: Link, handle: unknown)}
  {#if handle}<DragHandle {handle} />{/if}
  <span class="mark" on:error|capture={() => onFaviconError(l.originalURL)}>
    {#if l.oneTime}
      <Monogram size={32} name={l.oneTime.kind === 'url' ? 'URL' : 'Text'} />
    {:else if faviconOf(l.originalURL)}
      <Logo size={32} inset={0.2} src={faviconOf(l.originalURL)} />
    {:else}
      <Monogram size={32} name={hostOf(l.originalURL) || l.shortURL} />
    {/if}
  </span>
{/snippet}

{#snippet clicks(l: Link)}
  {#if !l.shortURL}
    <Skeleton width="32px" height="20px" />
  {:else}
    <span class="clicks" title="{formatCount(l.clickCount)} {l.clickCount === 1 ? 'click' : 'clicks'}">{formatCount(l.clickCount)}</span>
    <span class="when t-caption t-faint">{relativeDate(l.createdAt)}</span>
  {/if}
{/snippet}

{#snippet badges(l: Link)}
  {#if verdictLabel(l.safeVerdict)}<Badge variant="error">{verdictLabel(l.safeVerdict)}</Badge>{/if}
  {#if l.settings}
    <span class="states" role="list" aria-label="Link state">
      {#each states(l.settings) as s (s)}<span role="listitem"><Badge>{s}</Badge></span>{/each}
    </span>
  {/if}
{/snippet}

{#snippet controls(l: Link)}
  <Switch
    checked={isPublic(l)}
    disabled={l.pending}
    label="Show {shortLabel(l)} on your page"
    data-switch={l.id}
    on:change={() => togglePublish(l)}
  />
  <IconButton icon="copy" label="Copy {shortLabel(l)}" disabled={l.pending} on:click={() => copy(l)} />
  <IconButton
    icon="settings"
    label="Settings for {shortLabel(l)}"
    disabled={l.pending || !l.settings}
    aria-haspopup="dialog"
    aria-expanded={sheetOpen && sheetLinkId === l.id}
    on:click={(e) => openSheet(l, e)}
  />
{/snippet}

{#snippet destination(l: Link)}
  <span class="line" title={l.originalURL}>{displayUrl(l.originalURL)}</span>
{/snippet}

<div class="page" data-page inert={sheetOpen}>
  <Container width="wide">
    <PageHeader back="/dashboard" backLabel="Dashboard" title="Links" description="Everything you've shortened. Switch one on to show it on your public page.">
      <svelte:fragment slot="actions">
        {#if data.user.handle}
          <Button icon="external" href={`/@${data.user.handle}`} target="_blank" rel="noopener">View page</Button>
        {/if}
      </svelte:fragment>
    </PageHeader>

    <Section title="New link" id="new">
      <Paper as="form" on:submit={(e) => { e.preventDefault(); add(); }}>
        <Stack gap={8}>
          <Input
            label="Long URL"
            icon="link"
            inputmode="url"
            maxlength="2048"
            placeholder="Paste a long URL"
            autocomplete="off"
            data-act="new-url"
            error={addError}
            bind:value={newURL}
          />
          <div class="pair">
            <Input label="Title" optional maxlength="80" placeholder="Shown on your page" bind:value={newTitle} />
            <Field label="Custom name" optional error={nameError} hint="Letters, numbers, - and _" let:id let:describedby let:invalid>
              <div class="ui-box" data-invalid={invalid || undefined}>
                <span class="ui-affix prefix">{namePrefix}</span>
                <input
                  data-ui
                  class="ui-native"
                  {id}
                  type="text"
                  maxlength="50"
                  placeholder="name"
                  autocomplete="off"
                  spellcheck="false"
                  aria-describedby={describedby}
                  aria-invalid={invalid || undefined}
                  bind:value={newName}
                />
              </div>
            </Field>
          </div>
          {#if addSuggestion}
            <div class="suggest">
              <Button size="sm" variant="secondary" on:click={() => add(addSuggestion)}>Use iksi.app/{addSuggestion}?</Button>
            </div>
          {/if}
          <div class="submit">
            <span class="publish">
              <Switch labelledby={ids.publish} bind:checked={newPublish} />
              <span id={ids.publish} class="t-label">Show on your page</span>
            </span>
            <Button type="submit" variant="primary" icon="plus" disabled={!canAdd}>Add link</Button>
          </div>
        </Stack>
      </Paper>
    </Section>

    {#if regularCount === 0}
      <Section title="Your links">
        <Paper padding="none">
          <EmptyState icon="link" title="No links yet" description="Paste a long URL above to make your first short link." />
        </Paper>
      </Section>
    {:else}
      <Section title="On your page" description="In the order visitors see them. Drag the grip to reorder.">
        <Paper padding="none">
          {#if onPage.length === 0}
            <EmptyState icon="eye" title="Nothing on your page yet" description="Switch a link on to show it on your public page." />
          {:else}
            <SortableList
              items={onPage}
              label="On your page"
              name={(l) => l.profileRow?.title || shortLabel(l)}
              disabled={anyPending}
              on:reorder={onReorder}
              let:item={l}
              let:handle
            >
              <Row muted={l.pending} data-link={l.id}>
                <svelte:fragment slot="leading">{@render leading(l, handle)}</svelte:fragment>
                <span class="clip">{l.profileRow?.title || 'Untitled'}</span>
                <svelte:fragment slot="subtitle">
                  {#if !l.shortURL}
                    <Skeleton width="96px" height="18px" />
                  {:else}
                    <span class="line t-mono">{shortLabel(l)}</span>
                  {/if}
                  {@render destination(l)}
                </svelte:fragment>
                <svelte:fragment slot="meta">{@render clicks(l)}</svelte:fragment>
                <svelte:fragment slot="actions">
                  {@render badges(l)}
                  {@render controls(l)}
                </svelte:fragment>
              </Row>
            </SortableList>
          {/if}
        </Paper>
      </Section>

      {#if others.length > 0}
        <Section title="Other links" description="Short links that are not on your page.">
          <Paper padding="none">
            <List label="Other links">
              {#each others as l (l.id)}
                <Row muted={l.pending} data-link={l.id}>
                  <svelte:fragment slot="leading">{@render leading(l, null)}</svelte:fragment>
                  {#if !l.shortURL}
                    <Skeleton width="120px" height="22px" />
                  {:else}
                    <span class="clip t-mono">{shortLabel(l)}</span>
                  {/if}
                  <svelte:fragment slot="subtitle">{@render destination(l)}</svelte:fragment>
                  <svelte:fragment slot="meta">{@render clicks(l)}</svelte:fragment>
                  <svelte:fragment slot="actions">
                    {@render badges(l)}
                    {@render controls(l)}
                  </svelte:fragment>
                </Row>
              {/each}
            </List>
          </Paper>
          {#if data.hasMore}
            <p class="more t-label t-muted">Showing the latest {formatCount(data.limit)} of {formatCount(data.totalCount)} links.</p>
          {/if}
        </Section>
      {/if}
    {/if}

    <Section title="One-time links" description="A URL or a text that opens once, then it is erased. Unopened links expire after {ONE_TIME_TTL_DAYS} days.">
      <Stack gap={16}>
        {#if oneTimes.length > 0}
          <Paper padding="none">
            <List label="One-time links">
              {#each oneTimes as l (l.id)}
                {@const state = ONE_TIME_STATE[l.oneTime.state]}
                <Row data-link={l.id}>
                  <svelte:fragment slot="leading">{@render leading(l, null)}</svelte:fragment>
                  <span class="clip t-mono">{shortLabel(l)}</span>
                  <svelte:fragment slot="subtitle">
                    {#if confirmingId === l.id}
                      Delete this one-time link?
                    {:else}
                      <span>One-time {l.oneTime.kind === 'url' ? 'URL' : 'text'}</span>
                    {/if}
                  </svelte:fragment>
                  <svelte:fragment slot="meta">
                    <span class="when t-caption t-faint">{relativeDate(l.createdAt)}</span>
                  </svelte:fragment>
                  <svelte:fragment slot="actions">
                    {#if confirmingId === l.id}
                      <Button size="sm" variant="ghost" data-confirm-cancel={l.id} on:click={() => keep(l)}>Cancel</Button>
                      <Button size="sm" variant="danger" on:click={() => confirmDelete(l)}>Delete</Button>
                    {:else}
                      <Badge variant={state.variant} dot={l.oneTime.state === 'unopened'}>{state.label}</Badge>
                      <IconButton icon="copy" label="Copy {shortLabel(l)}" on:click={() => copy(l)} />
                      <IconButton icon="trash" variant="danger" label="Delete {shortLabel(l)}" data-delete={l.id} on:click={() => askDelete(l)} />
                    {/if}
                  </svelte:fragment>
                </Row>
              {/each}
            </List>
          </Paper>
        {/if}
        <OneTimeLinkForm on:created={onOneTimeCreated} />
      </Stack>
    </Section>
  </Container>
</div>

{#if sheetLink && sheetLink.settings}
  <LinkSettings
    bind:open={sheetOpen}
    id={sheetLink.id}
    settings={sheetLink.settings}
    short={shortLabel(sheetLink)}
    pageTitle={sheetLink.profileRow?.title ?? ''}
    deletable
    on:close={onSheetClose}
    on:saved={(e) => onSettingsSaved(sheetLink.id, e.detail)}
    on:title={(e) => saveTitle(sheetLink, e.detail)}
    on:delete={() => deleteFromSheet(sheetLink)}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
  }
  .clip {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .line {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mark { display: inline-flex; }
  .clicks {
    display: block;
    color: var(--text-primary);
  }
  .when { display: block; }
  .states {
    display: inline-flex;
    gap: 4px;
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
  }
  .prefix {
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The prefix reads as one address with the typed name. */
  .ui-box > .prefix {
    margin-right: -8px;
    color: var(--text-muted);
  }
  .suggest { margin-top: -4px; }
  .submit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    padding-top: 8px;
  }
  .publish {
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .more { margin: 12px 0 0; }

  /* Phones: the row keeps its text room; badges and the favicon, which the
     sheet and the destination line already cover, step aside. */
  @media (max-width: 639px) {
    .mark,
    .states,
    .when { display: none; }
    /* A row whose only leading item is the hidden mark drops its gap too. */
    .page :global(.leading:has(> .mark:only-child)) { display: none; }
    .pair { grid-template-columns: minmax(0, 1fr); gap: 8px; }
    .submit > :global(button) { width: 100%; }
  }
</style>
