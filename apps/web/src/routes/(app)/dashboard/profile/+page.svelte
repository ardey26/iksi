<script lang="ts">
  import { invalidateAll } from '$app/navigation';

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
      avatarUrl: data.profile?.avatarUrl ?? '',
      accent: data.profile?.accent ?? '#3B82F6',
      brightness: origBright
    };
    dirty = displayName !== orig.displayName || bio !== orig.bio || avatarUrl !== orig.avatarUrl
      || accent !== orig.accent || brightness !== orig.brightness;
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

<section class="w-full max-w-2xl mx-auto space-y-12">
  <header>
    <p class="text-sm mb-8" style="color: var(--text-muted);">
      <a href="/dashboard" class="hover:opacity-70 transition-opacity">← Dashboard</a>
    </p>
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">Profile</h1>
  </header>

  <!-- Identity -->
  <div class="space-y-4">
    <div>
      <h2 class="text-base font-medium" style="color: var(--text-primary);">Identity</h2>
      <p class="text-sm mt-1" style="color: var(--text-muted);">How you show up on your public page.</p>
    </div>
    <div class="rounded-xl p-6 space-y-5" style="background: var(--surface); border: 1px solid var(--border);">
      <label class="block space-y-2">
        <span class="text-sm" style="color: var(--text-muted);">Display name</span>
        <input type="text" bind:value={displayName} maxlength="80" placeholder={data.user.twitterHandle ?? data.user.googleEmail?.split('@')[0] ?? 'Your name'}
               class="w-full px-3 py-2.5 rounded-md text-base outline-none transition-colors"
               style="background: var(--bg); border: 1px solid var(--border); color: var(--text-primary);" />
      </label>

      <label class="block space-y-2">
        <span class="text-sm flex items-baseline justify-between" style="color: var(--text-muted);">
          <span>Bio</span>
          <span class="text-xs tabular-nums">{bio.length}/200</span>
        </span>
        <textarea bind:value={bio} maxlength="200" rows="3" placeholder="A line or two about you."
                  class="w-full px-3 py-2.5 rounded-md text-base outline-none resize-none transition-colors"
                  style="background: var(--bg); border: 1px solid var(--border); color: var(--text-primary);"></textarea>
      </label>

      <label class="block space-y-2">
        <span class="text-sm" style="color: var(--text-muted);">Avatar URL</span>
        <input type="url" bind:value={avatarUrl} placeholder="https://..."
               class="w-full px-3 py-2.5 rounded-md text-base outline-none transition-colors"
               style="background: var(--bg); border: 1px solid var(--border); color: var(--text-primary);" />
      </label>
    </div>
  </div>

  <!-- Appearance -->
  <div class="space-y-4">
    <div>
      <h2 class="text-base font-medium" style="color: var(--text-primary);">Appearance</h2>
      <p class="text-sm mt-1" style="color: var(--text-muted);">Pick a color and a brightness. The full palette is derived from both.</p>
    </div>

    <div class="rounded-xl p-6 space-y-6" style="background: var(--surface); border: 1px solid var(--border);">
      <!-- Accent -->
      <div class="flex items-center gap-4">
        <label class="relative w-12 h-12 rounded-full overflow-hidden cursor-pointer shrink-0" style="background: {accent}; box-shadow: 0 0 0 4px color-mix(in srgb, {accent} 20%, transparent);">
          <input type="color" bind:value={accent} class="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <div class="flex flex-col">
          <span class="text-sm font-medium tabular-nums" style="color: var(--text-primary);">{accent.toUpperCase()}</span>
          <span class="text-xs" style="color: var(--text-muted);">Click swatch to change</span>
        </div>
      </div>

      <!-- Brightness slider -->
      <div class="space-y-2">
        <div class="flex items-baseline justify-between">
          <span class="text-sm" style="color: var(--text-muted);">Brightness</span>
          <span class="text-xs tabular-nums" style="color: var(--text-muted);">{Math.round(brightness)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          bind:value={brightness}
          class="w-full brightness-slider"
          aria-label="Palette brightness"
        />
        <div class="flex justify-between text-xs" style="color: var(--text-muted); opacity: 0.7;">
          <span>Dark</span>
          <span>Light</span>
        </div>
      </div>

      <!-- Live preview — mirrors the /@handle card layout -->
      <div class="space-y-2">
        <span class="text-xs uppercase tracking-wide" style="color: var(--text-muted);">Preview</span>
        <div class="rounded-2xl p-6 transition-colors"
             style="{paletteStyle} background: var(--p-bg);">
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
      </div>
    </div>
  </div>

  <!-- Save profile changes: last thing on the page -->
  <div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border);">
    <button
      on:click={saveProfile}
      disabled={!dirty || saving}
      class="px-5 py-2.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
      style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer;"
    >
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
    </button>
    {#if dirty && !saving}
      <span class="text-xs" style="color: var(--text-muted);">Unsaved changes</span>
    {/if}
  </div>
</section>

<style>
  .brightness-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    background: linear-gradient(to right, #0a0a0b, #fafafa);
    border-radius: 999px;
    outline: none;
  }
  .brightness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    background: #fff;
    border: 2px solid var(--accent);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .brightness-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: #fff;
    border: 2px solid var(--accent);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .preview-card {
    box-shadow:
      0 16px 40px -14px oklch(from var(--accent) 0.15 0.08 h / 0.35),
      0 4px 14px -4px oklch(from var(--accent) 0.15 0.04 h / 0.18);
  }
</style>
