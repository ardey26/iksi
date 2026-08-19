<script lang="ts">
  import { onMount } from 'svelte';

  export let data;

  let copied = false;
  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/@${data.handle}`);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {}
  }

  function fmtClicks(n: number) {
    if (n < 1000) return n.toString();
    if (n < 10000) return (n / 1000).toFixed(1) + 'k';
    if (n < 1000000) return Math.round(n / 1000) + 'k';
    return (n / 1000000).toFixed(1) + 'M';
  }

  function hostOf(u: string) {
    try { return new URL(u).hostname.replace(/^www\./, ''); }
    catch { return u; }
  }

  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '·';
    if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
    return (parts[0][0] + parts[1][0]).toLowerCase();
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

  // `theme` column stores brightness as string "0".."100".
  function brightnessOf(t) {
    if (!t) return 20;
    const n = parseInt(t, 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    if (t === 'light') return 100;
    return 20;
  }
  $: b = brightnessOf(data.theme);
  $: bL = Math.max(0.04, Math.min(0.99, b / 100));
  $: isLight = bL > 0.5;
  $: sL = Math.min(1, bL + (isLight ? 0.025 : 0.03));
  $: tL = isLight ? Math.max(0.14, 0.94 - bL) : Math.min(0.94, bL + 0.75);
  $: mL = isLight ? Math.max(0.38, bL - 0.30) : Math.min(0.72, bL + 0.38);
  $: brL = isLight ? Math.max(0.80, bL - 0.10) : Math.min(0.32, bL + 0.14);
  $: accentReadableL = isLight ? 0.48 : 0.72;
  $: paletteStyle =
    `--accent: ${data.accent};
     --accent-text: oklch(from ${data.accent} ${accentReadableL} max(c, 0.09) h);
     --bg: oklch(from ${data.accent} ${bL} 0.020 h);
     --surface: oklch(from ${data.accent} ${sL} 0.014 h);
     --border: oklch(from ${data.accent} ${brL} 0.050 h);
     --text-primary: oklch(from ${data.accent} ${tL} 0.008 h);
     --text-muted: oklch(from ${data.accent} ${mL} 0.018 h);`;

  // Canonical URL and derived SEO strings for the head.
  $: profileUrl = `https://www.iksi.app/@${data.handle}`;
  $: ogImageUrl = `https://www.iksi.app/api/@${data.handle}/og`;
  $: seoTitle = `${data.displayName} (@${data.handle}) — iksi`;
  $: seoDescription = data.bio
    ? data.bio.replace(/\s+/g, ' ').trim().slice(0, 160)
    : `${data.displayName}'s links on iksi. Follow @${data.handle}.`;

  // Schema.org Person JSON-LD — gives Google structured info about this
  // profile so it can render richer results and understand identity.
  $: personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: data.displayName,
    alternateName: `@${data.handle}`,
    url: profileUrl,
    ...(data.avatarUrl ? { image: data.avatarUrl } : {}),
    ...(data.bio ? { description: data.bio } : {}),
    ...(data.sameAs && data.sameAs.length ? { sameAs: data.sameAs } : {})
  };
  $: personLdJson = JSON.stringify(personLd);
</script>

<svelte:head>
  <title>{seoTitle}</title>
  <meta name="title" content={seoTitle} />
  <meta name="description" content={seoDescription} />
  <meta name="author" content={data.displayName} />
  <meta name="robots" content="index, follow" />
  <meta name="language" content="English" />
  <link rel="canonical" href={profileUrl} />

  <!-- Open Graph — dynamic per-user card (avatar + bio + @handle + iksi mark) -->
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="iksi" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:title" content={seoTitle} />
  <meta property="og:description" content={seoDescription} />
  <meta property="og:url" content={profileUrl} />
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

<div class="iksi-profile min-h-screen flex items-center justify-center p-4 sm:p-8"
     style="{paletteStyle} background: var(--bg); color: var(--text-primary);">

  <div class="w-full max-w-lg rounded-[2rem] overflow-visible profile-card"
       style="background: var(--surface); border: 1px solid var(--border);">

    <!-- Header -->
    <div class="p-7 sm:p-8 flex items-start gap-4">
      {#if data.avatarUrl}
        <img src={data.avatarUrl} alt="" class="w-14 h-14 rounded-full object-cover shrink-0"
             style="border: 1px solid var(--border);" />
      {:else}
        <div class="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-lg font-semibold"
             style="background: oklch(from var(--accent) 0.90 max(c, 0.08) h); color: var(--accent-text);">
          {initials(data.displayName)}
        </div>
      {/if}

      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight leading-tight truncate"
            style="color: var(--text-primary);">{data.displayName}</h1>
        <p class="text-sm mt-1 truncate" style="color: var(--accent-text);">iksi.app/@{data.handle}</p>
      </div>

      <button
        on:click={copyProfileUrl}
        class="px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90 shrink-0"
        style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer;"
      >{copied ? 'Copied' : 'Copy'}</button>
    </div>

    <!-- Bio -->
    {#if data.bio}
      <div class="px-7 sm:px-8 pb-8">
        <p class="text-2xl leading-tight font-medium" style="color: var(--text-primary);">
          {data.bio}
        </p>
      </div>
    {/if}

    {#if data.rows.length === 0}
      <div class="px-7 sm:px-8 pb-8 pt-6" style="border-top: 1px solid var(--border);">
        <p class="text-sm" style="color: var(--text-muted);">Nothing here yet.</p>
      </div>
    {:else}
      <ul>
        {#each data.rows as row, i}
          <li class="row-item relative flex items-stretch" style="border-top: 1px solid var(--border);">
            {#if row.href}
              <a href={row.href}
                 class="row group flex items-center gap-4 flex-1 min-w-0 pl-7 sm:pl-8 pr-3 py-5 transition-colors"
                 style="color: var(--text-primary);">
                <span class="text-sm tabular-nums shrink-0" style="color: var(--text-muted); opacity: 0.6;">
                  {i + 1}.
                </span>
                <div class="text-lg font-semibold tracking-tight truncate min-w-0 flex-1"
                     style="color: var(--text-primary);">
                  {row.title}
                </div>
              </a>

              <!-- Kebab button, first-class sibling of the anchor -->
              <button
                type="button"
                on:click|preventDefault|stopPropagation={() => toggleShare(row.id)}
                aria-label="Share options"
                aria-expanded={openShareId === row.id}
                class="kebab-btn shrink-0 pr-6 sm:pr-7 pl-3 py-5 transition-opacity"
                style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>

              {#if openShareId === row.id}
                <div class="share-menu absolute right-4 top-full z-20 mt-1 min-w-[220px] rounded-xl overflow-hidden py-1"
                     style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 12px 32px -8px oklch(from var(--accent) 0.15 0.05 h / 0.35), 0 4px 12px -4px oklch(from var(--accent) 0.15 0.03 h / 0.2);">
                  <button type="button"
                          on:click={() => copyRowUrl(row)}
                          class="menu-item w-full text-left px-4 py-2.5 text-sm transition-colors"
                          style="color: var(--text-primary); background: transparent; border: none; cursor: pointer;">
                    {copiedRowId === row.id ? 'Copied!' : 'Copy link'}
                  </button>
                  <a href={tweetIntent(row)} target="_blank" rel="noopener"
                     class="menu-item block px-4 py-2.5 text-sm transition-colors"
                     style="color: var(--text-primary);">Share on X</a>
                  <a href={fbShare(row)} target="_blank" rel="noopener"
                     class="menu-item block px-4 py-2.5 text-sm transition-colors"
                     style="color: var(--text-primary);">Share on Facebook</a>
                  <div class="mx-4 my-1" style="border-top: 1px solid var(--border);"></div>
                  <a href="https://iksi.app/" target="_blank" rel="noopener"
                     class="menu-item block px-4 py-2.5 text-sm transition-colors"
                     style="color: var(--text-muted);">Try iksi →</a>
                </div>
              {/if}
            {:else}
              <div class="flex items-center gap-4 flex-1 px-7 sm:px-8 py-5"
                   style="color: var(--text-muted); opacity: 0.5;">
                <span class="text-sm tabular-nums opacity-60">{i + 1}.</span>
                <div class="text-lg font-semibold tracking-tight truncate flex-1">{row.title}</div>
                <span class="text-xs uppercase tracking-wider opacity-60">unavailable</span>
              </div>
            {/if}
          </li>
        {/each}
        <li class="py-3" style="border-top: 1px solid var(--border);"></li>
      </ul>
    {/if}

    <!-- Footer -->
    <div class="px-7 sm:px-8 pb-6 pt-2 text-center">
      <span class="text-sm" style="color: var(--text-muted);">
        {data.handle} shortens links with
        <a href="https://iksi.app/" target="_blank" rel="noopener"
           class="underline decoration-1 underline-offset-2 transition-colors hover:opacity-70"
           style="color: var(--text-primary);">iksi</a>
      </span>
    </div>

  </div>
</div>

<style>
  /* Soft, accent-tinted drop shadow — layered for depth */
  .profile-card {
    box-shadow:
      0 24px 60px -20px oklch(from var(--accent) 0.15 0.08 h / 0.35),
      0 8px 24px -6px oklch(from var(--accent) 0.15 0.04 h / 0.18);
  }

  /* Tint the whole li (including the kebab sibling) when hovered. */
  .row-item:hover {
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }
  .kebab-btn:hover {
    color: var(--text-primary);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .menu-item:hover {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  /* Skeleton shimmer for streaming rows */
  .skeleton {
    background: color-mix(in srgb, var(--text-muted) 22%, transparent);
    animation: shimmer 1.4s ease-in-out infinite;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.6; }
  }
</style>
