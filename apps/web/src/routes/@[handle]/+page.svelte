<script lang="ts">
  import { onMount } from 'svelte';
  import PayButton from '#lib/components/PayButton.svelte';
  import { Button, IconButton, List, Paper, Row } from '#lib/ui/index.js';
  import { canonicalProfileUrl, profileLabel, profileShareUrl } from '#lib/subdomains.js';
  import { paletteCss, profilePalette } from '#lib/profile-palette.js';

  export let data;

  let copied = false;
  let avatarBroken = false;
  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {}
  }

  // Up to two initials, letters or digits only; never punctuation like "@".
  function initials(name: string) {
    const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length === 0) return '?';
    return (words.length === 1 ? words[0].slice(0, 1) : words[0][0] + words[1][0]).toUpperCase();
  }

  // --- Share popup state ---
  let openShareId: number | null = null;
  let copiedRowId: number | null = null;

  function toggleShare(id: number) {
    openShareId = openShareId === id ? null : id;
  }
  function closeShare() { openShareId = null; }

  async function copyRowUrl(row: any) {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/${row.shortURL}`);
      copiedRowId = row.id;
      setTimeout(() => { if (copiedRowId === row.id) copiedRowId = null; }, 1400);
    } catch {}
  }

  function tweetIntent(row: any) {
    const text = encodeURIComponent('Shortened this link with iksi!');
    const url = encodeURIComponent(`https://iksi.app/${row.shortURL}`);
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  }
  function fbShare(row: any) {
    const url = encodeURIComponent(`https://iksi.app/${row.shortURL}`);
    // Facebook's sharer no longer honors custom quote params; the OG data on
    // the destination fills in the preview text.
    return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  }

  onMount(() => {
    function onDocClick(e: MouseEvent) {
      if (openShareId === null) return;
      const target = e.target as HTMLElement;
      if (!target.closest?.('.share-menu, .kebab-btn')) closeShare();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeShare();
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  });

  $: paletteStyle = paletteCss(profilePalette(data.accent, data.theme));

  // backgroundUrl lands in an inline style: accept only https URLs with none
  // of the characters that could end the quoted url() string or the declaration.
  function safeBackground(u) {
    if (typeof u !== 'string' || /["'\\()\s;{}<>]/.test(u)) return null;
    try {
      const parsed = new URL(u);
      return parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
      return null;
    }
  }
  $: bgUrl = safeBackground(data.backgroundUrl);
  $: bgStyle = bgUrl ? ` background: var(--bg) url("${bgUrl}") center / cover no-repeat fixed;` : ' background: var(--bg);';

  // The address people copy: <handle>.iksi.app once subdomains are on,
  // www/@handle until then. Search engines always get www/@handle.
  $: profileUrl = profileShareUrl(data.handle, !!data.subdomains);
  $: canonicalUrl = canonicalProfileUrl(data.handle);
  $: ogImageUrl = `https://www.iksi.app/api/@${data.handle}/og`;
  $: seoTitle = `${data.displayName} (@${data.handle}) — iksi`;
  $: seoDescription = data.bio
    ? clip(data.bio.replace(/\s+/g, ' ').trim(), 160)
    : `${data.displayName}'s links on iksi. Follow @${data.handle}.`;
  // A profile with no bio and no live links is thin content: keep it out of the index.
  // Mirrors the sitemap's filter in routes/sitemap.xml.
  $: indexable = !!data.bio?.trim() || data.rows.some((r) => r.href);

  /** Cuts at the last word boundary that fits, so a description never ends mid-word. */
  function clip(s: string, max: number) {
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '') + '…';
  }

  // Schema.org Person JSON-LD — gives Google structured info about this
  // profile so it can render richer results and understand identity.
  $: personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: data.displayName,
    alternateName: `@${data.handle}`,
    url: canonicalUrl,
    ...(data.avatarUrl ? { image: data.avatarUrl } : {}),
    ...(data.bio ? { description: data.bio } : {}),
    ...(data.sameAs && data.sameAs.length ? { sameAs: data.sameAs } : {})
  };
  // Escape every `<` so a bio containing a closing script tag cannot break out of the JSON-LD block.
  $: personLdJson = JSON.stringify(personLd).replace(/</g, '\\u003c');
</script>

<svelte:head>
  <title>{seoTitle}</title>
  <meta name="description" content={seoDescription} />
  <meta name="author" content={data.displayName} />
  <meta name="robots" content={indexable ? 'index, follow' : 'noindex, follow'} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph — dynamic per-user card (avatar + bio + @handle + iksi mark) -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="iksi" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content={seoTitle} />
  <meta property="og:description" content={seoDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={`${data.displayName} on iksi`} />
  <meta property="profile:username" content={data.handle} />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seoTitle} />
  <meta name="twitter:description" content={seoDescription} />
  <meta name="twitter:image" content={ogImageUrl} />

  <!-- Schema.org Person structured data (rich results in Google search) -->
  {@html `<script type="application/ld+json">${personLdJson}</script>`}
</svelte:head>

<div class="iksi-profile" data-palette style="{paletteStyle}{bgStyle} color: var(--text-primary);">
  {#if bgUrl}
    <!-- Solid scrim (no gradient) so the photo never fights the palette. -->
    <div class="profile-scrim" aria-hidden="true"
         style="background: color-mix(in srgb, var(--bg) 72%, transparent);"></div>
  {/if}

  <main class="profile">
    <header class="head">
      {#if data.avatarUrl && !avatarBroken}
        <!-- Hot-linked avatars (LinkedIn, Twitter CDNs) expire; fall back to initials instead of a broken image. -->
        <img src={data.avatarUrl} alt="" class="avatar" width="72" height="72"
             on:error={() => (avatarBroken = true)} />
      {:else}
        <div class="avatar avatar-initials" aria-hidden="true">{initials(data.displayName)}</div>
      {/if}

      <h1 class="name">{data.displayName}</h1>
      <div class="handle">
        <span class="handle-url">{profileLabel(data.handle, !!data.subdomains)}</span>
        <Button size="sm" variant="ghost" icon={copied ? 'check' : 'copy'} on:click={copyProfileUrl}>
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>

      {#if data.bio}
        <p class="bio">{data.bio}</p>
      {/if}

      {#if data.pay}
        <div class="pay">
          <PayButton handle={data.handle} displayName={data.displayName} label={data.pay.label} methods={data.pay.methods} />
        </div>
      {/if}
    </header>

    <Paper padding="none" class="links">
      {#if data.rows.length === 0}
        <p class="empty">Nothing here yet.</p>
      {:else}
        <List label="Links">
          {#each data.rows as row (row.id)}
            {#if row.href}
              <Row interactive class="link-row">
                <a href={row.href} class="row-link">{row.title}</a>
                <svelte:fragment slot="actions">
                  <span class="share" class:open={openShareId === row.id}>
                    <IconButton
                      icon="more"
                      label="Share {row.title}"
                      class="kebab-btn"
                      aria-haspopup="true"
                      aria-expanded={openShareId === row.id}
                      on:click={(e) => { e.preventDefault(); e.stopPropagation(); toggleShare(row.id); }}
                    />
                    {#if openShareId === row.id}
                      <div class="share-menu">
                        <button data-ui type="button" class="menu-item" on:click={() => copyRowUrl(row)}>
                          {copiedRowId === row.id ? 'Copied' : 'Copy link'}
                        </button>
                        <a data-ui href={tweetIntent(row)} target="_blank" rel="noopener" class="menu-item">Share on X</a>
                        <a data-ui href={fbShare(row)} target="_blank" rel="noopener" class="menu-item">Share on Facebook</a>
                        <div class="menu-sep" role="separator"></div>
                        <a data-ui href="https://www.iksi.app/" target="_blank" rel="noopener" class="menu-item muted">Try iksi</a>
                      </div>
                    {/if}
                  </span>
                </svelte:fragment>
              </Row>
            {:else}
              <Row muted title={row.title}>
                <span slot="meta" class="t-caption">Unavailable</span>
              </Row>
            {/if}
          {/each}
        </List>
      {/if}
    </Paper>

    <footer class="foot">
      @{data.handle} shortens links with
      <a href="https://www.iksi.app/" target="_blank" rel="noopener" class="foot-link">iksi</a>
    </footer>
  </main>
</div>

<style>
  .iksi-profile {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    min-height: 100dvh;
  }
  .profile-scrim { position: fixed; inset: 0; z-index: 0; pointer-events: none; }

  /* Public page column: 480, generous top space (DESIGN.md › Layout). */
  .profile {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: calc(var(--width-narrow) + var(--gutter) * 2);
    margin: 0 auto;
    padding: 48px var(--gutter) 40px;
  }
  @media (min-width: 768px) {
    .profile { padding-top: 96px; }
  }

  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    text-align: center;
  }
  .avatar {
    flex: none;
    width: 72px;
    height: 72px;
    margin-bottom: 16px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--border);
  }
  .avatar-initials {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: oklch(from var(--accent) 0.36 max(c, 0.09) h);
    background-color: oklch(from var(--accent) 0.90 max(c, 0.08) h);
  }
  .name {
    max-width: 100%;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 28px;
    line-height: 32px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-primary);
  }
  .handle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    max-width: 100%;
    margin-top: 6px;
  }
  .handle-url {
    min-width: 0;
    overflow: hidden;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--accent-text);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .bio {
    max-width: 400px;
    margin: 16px 0 0;
    font-size: 17px;
    line-height: 26px;
    color: var(--text-primary);
    text-wrap: pretty;
    overflow-wrap: anywhere;
  }
  .pay {
    width: 100%;
    margin-top: 24px;
  }

  .empty {
    margin: 0;
    padding: 20px 16px;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
    text-align: center;
  }

  /* The whole row is the link; the share button sits above it. */
  :global(.link-row) { position: relative; }
  .row-link {
    color: var(--text-primary);
    text-decoration: none;
  }
  .row-link::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  .row-link:focus-visible { outline: none; }
  .row-link:focus-visible::after {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .share {
    position: relative;
    z-index: 1;
    display: inline-flex;
  }
  /* Above the next rows' share buttons. */
  .share.open { z-index: 30; }
  .share-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 20;
    width: 220px;
    padding: 4px;
    text-align: left;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
    box-shadow: var(--overlay-shadow);
  }
  .menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 40px;
    padding: 0 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    color: var(--text-primary);
    background-color: transparent;
    border: 0;
    border-radius: var(--radius-control);
    cursor: pointer;
  }
  .menu-item:hover { background-color: var(--surface-2); }
  .menu-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .menu-item.muted { color: var(--text-muted); }
  .menu-sep {
    height: 1px;
    margin: 4px 6px;
    background-color: var(--border);
  }
  @media (max-width: 639px) {
    .menu-item { min-height: 44px; }
  }

  .foot {
    margin-top: 32px;
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
    text-align: center;
  }
  .foot-link {
    color: var(--text-primary);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
</style>
