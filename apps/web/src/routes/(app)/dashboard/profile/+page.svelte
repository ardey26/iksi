<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import ImageUpload from '#lib/components/ImageUpload.svelte';

  export let data;

  // Reuse `theme` column: numeric-in-string 0..100 (brightness). Legacy values map:
  //   'light' → 100, everything else ('dark' | 'default' | 'mono' | undefined) → 20.
  function themeToBrightness(t: string | null | undefined): number {
    if (!t) return 20;
    const n = parseInt(t, 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    if (t === 'light') return 100;
    return 20;
  }

  let displayName = data.profile?.displayName ?? '';
  let bio = data.profile?.bio ?? '';
  let avatarUrl = data.profile?.avatarUrl ?? '';
  // Avatar value the server has stored. Moves together with avatarUrl on
  // upload/remove/save so those never count as unsaved changes.
  let savedAvatarUrl = data.profile?.avatarUrl ?? '';
  let backgroundUrl: string | null = data.profile?.backgroundUrl ?? null;
  let showUrlInput = false;
  let accent = data.profile?.accent ?? '#3B82F6';
  let brightness: number = themeToBrightness(data.profile?.theme);

  let saving = false;
  let saved = false;
  let dirty = false;

  $: {
    const origBright = themeToBrightness(data.profile?.theme);
    const orig = {
      displayName: data.profile?.displayName ?? '',
      bio: data.profile?.bio ?? '',
      avatarUrl: savedAvatarUrl,
      accent: data.profile?.accent ?? '#3B82F6',
      brightness: origBright
    };
    dirty = displayName !== orig.displayName || bio !== orig.bio || avatarUrl !== orig.avatarUrl
      || accent !== orig.accent || brightness !== orig.brightness;
  }

  // Uploads are persisted by /api/media immediately; refresh load data so the
  // form is not considered dirty because of them.
  async function refresh() {
    try {
      await invalidateAll();
    } catch {
      // The change already succeeded on the server; a failed refresh must not
      // leave the form looking dirty.
    }
  }
  async function onAvatarChange(e: CustomEvent<{ url: string | null; persisted: boolean }>) {
    const url = e.detail.url ?? '';
    avatarUrl = url;
    if (!e.detail.persisted) return; // unsaved typed URL cleared locally
    savedAvatarUrl = url;
    await refresh();
  }
  async function onBackgroundChange(e: CustomEvent<{ url: string | null; persisted: boolean }>) {
    backgroundUrl = e.detail.url;
    await refresh();
  }

  async function saveProfile() {
    if (!dirty || saving) return;
    saving = true;
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateProfile',
        displayName, bio, avatarUrl, accent,
        theme: String(Math.round(brightness))
      })
    });
    saving = false;
    if (res.ok) {
      // Server may have normalized the avatar URL (e.g. Google Drive rewrite);
      // reflect that back into the input.
      const body = await res.json().catch(() => ({}));
      if (typeof body.avatarUrl === 'string' || body.avatarUrl === null) {
        avatarUrl = body.avatarUrl ?? '';
      }
      savedAvatarUrl = avatarUrl;
      saved = true;
      await invalidateAll();
      setTimeout(() => { saved = false; }, 1400);
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Save failed');
    }
  }

  // Palette derivation (must mirror /@handle logic exactly).
  // OKLCH-based: perceptually uniform lightness across all hues.
  $: paletteStyle = (() => {
    const bL = Math.max(0.04, Math.min(0.99, brightness / 100));
    const isLight = bL > 0.5;
    const sL = Math.min(1, bL + (isLight ? 0.025 : 0.03));
    const tL = isLight ? Math.max(0.14, 0.94 - bL) : Math.min(0.94, bL + 0.75);
    const mL = isLight ? Math.max(0.38, bL - 0.30) : Math.min(0.72, bL + 0.38);
    const brL = isLight ? Math.max(0.80, bL - 0.10) : Math.min(0.32, bL + 0.14);
    const accentReadableL = isLight ? 0.48 : 0.72;
    return `--accent: ${accent};
            --p-accent-text: oklch(from ${accent} ${accentReadableL} max(c, 0.09) h);
            --p-bg: oklch(from ${accent} ${bL} 0.020 h);
            --p-surface: oklch(from ${accent} ${sL} 0.014 h);
            --p-border: oklch(from ${accent} ${brL} 0.050 h);
            --p-text: oklch(from ${accent} ${tL} 0.008 h);
            --p-muted: oklch(from ${accent} ${mL} 0.018 h);`;
  })();

  $: previewName = displayName || data.user.twitterHandle || data.user.googleEmail?.split('@')[0] || '@you';
  $: previewHandle = data.user.handle || data.user.twitterHandle || 'you';
  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '·';
    if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
    return (parts[0][0] + parts[1][0]).toLowerCase();
  }
  const sampleRows = [
    { title: 'Website', short: 'me', dest: 'yoursite.com' },
    { title: 'Latest post', short: 'post', dest: 'blog.io' },
    { title: 'Newsletter', short: 'sub', dest: 'buttondown.email' }
  ];
</script>

<svelte:head><title>Profile — iksi</title></svelte:head>

<section class="w-full max-w-2xl mx-auto d-scope">
  <header class="mb-12">
    <p class="text-sm mb-8" style="color: var(--text-muted);">
      <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
    </p>
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Profile</h1>
  </header>

  <!-- Identity -->
  <section class="d-section" aria-labelledby="p-identity">
    <h2 class="d-title" id="p-identity">Identity</h2>
    <p class="d-desc">How you show up on your public page.</p>
    <div class="d-spec">
      <div class="d-row">
        <span class="d-label">Avatar</span>
        <div class="d-control">
          <ImageUpload kind="avatar" value={avatarUrl || null} savedUrl={savedAvatarUrl || null} on:change={onAvatarChange}>
            <button type="button" on:click={() => (showUrlInput = !showUrlInput)}
                    class="d-btn d-btn-text" aria-expanded={showUrlInput} aria-controls="p-avatar-url">
              Paste a URL instead
            </button>
          </ImageUpload>
          {#if showUrlInput}
            <input id="p-avatar-url" type="url" bind:value={avatarUrl} placeholder="https://..." aria-label="Avatar URL" class="d-field" />
          {/if}
        </div>
      </div>

      <div class="d-row">
        <label class="d-label" for="p-name">Display name</label>
        <div class="d-control">
          <input id="p-name" type="text" bind:value={displayName} maxlength="80"
                 placeholder={data.user.twitterHandle ?? data.user.googleEmail?.split('@')[0] ?? 'Your name'}
                 class="d-field" />
        </div>
      </div>

      <div class="d-row">
        <label class="d-label" for="p-bio">Bio</label>
        <div class="d-control">
          <textarea id="p-bio" bind:value={bio} maxlength="200" rows="3" placeholder="A line or two about you."
                    aria-describedby="p-bio-count" class="d-field"></textarea>
          <p class="d-hint text-right tabular-nums" id="p-bio-count">{bio.length} of 200</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Appearance -->
  <section class="d-section" aria-labelledby="p-appearance">
    <h2 class="d-title" id="p-appearance">Appearance</h2>
    <p class="d-desc">Pick a color and a brightness. The full palette is derived from both.</p>
    <div class="d-spec">
      <div class="d-row">
        <span class="d-label">Accent</span>
        <div class="d-control d-inline">
          <label class="swatch" style="background-color: {accent};">
            <input type="color" bind:value={accent} aria-label="Accent color" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          </label>
          <span class="d-readout">{accent.toUpperCase()}</span>
        </div>
      </div>

      <div class="d-row">
        <span class="d-label">Brightness</span>
        <div class="d-control">
          <div class="d-inline flex-nowrap">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={brightness}
              class="brightness-slider"
              aria-label="Palette brightness"
            />
            <span class="d-readout readout">{Math.round(brightness)}</span>
          </div>
          <div class="ends" aria-hidden="true"><span>Dark</span><span>Light</span></div>
        </div>
      </div>

      <div class="d-row">
        <span class="d-label">Background</span>
        <div class="d-control">
          <ImageUpload kind="background" value={backgroundUrl} on:change={onBackgroundChange} />
        </div>
      </div>
    </div>
  </section>

  <!-- Live preview — mirrors the /@handle card layout -->
  <section class="d-section" aria-labelledby="p-preview">
    <h2 class="d-title" id="p-preview">Preview</h2>
    <p class="d-desc">Your public page with these settings.</p>
    <div class="stage mt-4 transition-colors"
         style="{paletteStyle} background-color: var(--p-bg);{backgroundUrl ? ` background-image: url('${backgroundUrl}'); background-size: cover; background-position: center;` : ''}">
      <div class="w-full rounded-2xl overflow-hidden preview-card"
           style="background: var(--p-surface); border: 1px solid var(--p-border); color: var(--p-text);">
        <!-- Header: avatar + identity + copy pill -->
        <div class="p-4 flex items-start gap-3">
          {#if avatarUrl}
            <img src={avatarUrl} alt="" class="w-10 h-10 rounded-full object-cover shrink-0"
                 style="border: 1px solid var(--p-border);" />
          {:else}
            <div class="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold"
                 style="background: oklch(from {accent} 0.90 max(c, 0.08) h); color: var(--p-accent-text);">
              {initials(previewName)}
            </div>
          {/if}
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold tracking-tight leading-tight truncate" style="color: var(--p-text);">{previewName}</div>
            <div class="text-xs mt-0.5 truncate" style="color: var(--p-accent-text);">iksi.app/@{previewHandle}</div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0"
                style="background: var(--p-text); color: var(--p-bg);">Copy</span>
        </div>

        <!-- Bio -->
        {#if bio}
          <div class="px-4 pb-4">
            <p class="text-sm leading-tight font-medium" style="color: var(--p-text);">{bio}</p>
          </div>
        {/if}

        <!-- Sample rows (kebab shown as visual cue) -->
        <div>
          {#each sampleRows as row, i}
            <div class="px-4 py-3 flex items-center gap-3" style="border-top: 1px solid var(--p-border);">
              <span class="text-xs tabular-nums" style="color: var(--p-muted); opacity: 0.6;">{i + 1}.</span>
              <div class="flex-1 min-w-0 text-sm font-semibold tracking-tight truncate" style="color: var(--p-text);">{row.title}</div>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" style="color: var(--p-muted);" aria-hidden="true">
                <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
              </svg>
            </div>
          {/each}
        </div>

        <!-- Footer -->
        <div class="px-4 pb-3 pt-2 text-center">
          <span class="text-xs" style="color: var(--p-muted);">
            {previewHandle} shortens links with <span class="underline decoration-1 underline-offset-2" style="color: var(--p-text);">iksi</span>
          </span>
        </div>
      </div>
    </div>
  </section>

  <!-- Save profile changes: last thing on the page -->
  <div class="save-bar">
    <button on:click={saveProfile} disabled={!dirty || saving} class="d-btn d-btn-primary">
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
    </button>
    <span class="text-[13px]" style="color: var(--text-muted); visibility: {dirty && !saving ? 'visible' : 'hidden'};">Unsaved changes</span>
  </div>
</section>

<style>
  .swatch {
    position: relative;
    display: block;
    flex: none;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  .swatch:focus-within {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }

  /* Flat hardware fader: hairline track, square cap. */
  .brightness-slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1 1 auto;
    min-width: 0;
    height: 24px;
    background: transparent;
    cursor: pointer;
  }
  .brightness-slider::-webkit-slider-runnable-track {
    height: 2px;
    background-color: var(--border);
    border-radius: 1px;
  }
  .brightness-slider::-moz-range-track {
    height: 2px;
    background-color: var(--border);
    border-radius: 1px;
  }
  .brightness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 20px;
    margin-top: -9px;
    background-color: var(--text-primary);
    border: none;
    border-radius: 3px;
  }
  .brightness-slider::-moz-range-thumb {
    width: 14px;
    height: 20px;
    background-color: var(--text-primary);
    border: none;
    border-radius: 3px;
  }
  .brightness-slider:focus {
    outline: none;
  }
  .brightness-slider:focus-visible::-webkit-slider-thumb {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }
  .brightness-slider:focus-visible::-moz-range-thumb {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }
  .readout {
    width: 32px;
    text-align: right;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    margin-right: 48px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .stage {
    padding: 24px;
    border-radius: 6px;
  }
  .preview-card {
    box-shadow:
      0 16px 40px -14px oklch(from var(--accent) 0.15 0.08 h / 0.35),
      0 4px 14px -4px oklch(from var(--accent) 0.15 0.04 h / 0.18);
  }

  .save-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
</style>
