<script lang="ts">
  export let data;

  let displayName = data.profile?.displayName ?? '';
  let bio = data.profile?.bio ?? '';
  let avatarUrl = data.profile?.avatarUrl ?? '';
  let accent = data.profile?.accent ?? '#3B82F6';
  // Reuse existing `theme` column: 'dark' | 'light'. Any legacy value → 'dark'.
  let mode: 'dark' | 'light' = data.profile?.theme === 'light' ? 'light' : 'dark';

  let saving = false;
  let saved = false;
  let dirty = false;

  $: {
    const origMode: 'dark' | 'light' = data.profile?.theme === 'light' ? 'light' : 'dark';
    const orig = {
      displayName: data.profile?.displayName ?? '',
      bio: data.profile?.bio ?? '',
      avatarUrl: data.profile?.avatarUrl ?? '',
      accent: data.profile?.accent ?? '#3B82F6',
      mode: origMode
    };
    dirty = displayName !== orig.displayName || bio !== orig.bio || avatarUrl !== orig.avatarUrl
      || accent !== orig.accent || mode !== orig.mode;
  }

  async function saveProfile() {
    if (!dirty || saving) return;
    saving = true;
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProfile', displayName, bio, avatarUrl, accent, theme: mode })
    });
    saving = false;
    if (res.ok) {
      saved = true;
      setTimeout(() => location.reload(), 400);
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Save failed');
    }
  }

  // Palette derivation (must match /@handle logic exactly)
  $: paletteStyle = mode === 'dark'
    ? `--accent: ${accent};
       --p-bg: color-mix(in srgb, ${accent} 8%, #000);
       --p-surface: color-mix(in srgb, ${accent} 16%, #0a0a0b);
       --p-border: color-mix(in srgb, ${accent} 25%, transparent);
       --p-text: color-mix(in srgb, #ffffff 96%, ${accent} 4%);
       --p-muted: color-mix(in srgb, #ffffff 60%, ${accent} 40%);`
    : `--accent: ${accent};
       --p-bg: color-mix(in srgb, ${accent} 8%, #fff);
       --p-surface: color-mix(in srgb, ${accent} 14%, #fafafa);
       --p-border: color-mix(in srgb, ${accent} 30%, transparent);
       --p-text: color-mix(in srgb, #0a0a0b 92%, ${accent} 8%);
       --p-muted: color-mix(in srgb, #0a0a0b 55%, ${accent} 45%);`;

  $: previewName = displayName || data.user.twitterHandle || '@you';
  $: previewInitial = previewName.charAt(0).toUpperCase();
  const sampleRows = ['Website', 'Latest post', 'Newsletter'];
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
        <input type="text" bind:value={displayName} maxlength="80" placeholder={data.user.twitterHandle}
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
      <p class="text-sm mt-1" style="color: var(--text-muted);">Pick a color and mode. Your public page's palette is derived from these.</p>
    </div>

    <div class="rounded-xl p-6 space-y-6" style="background: var(--surface); border: 1px solid var(--border);">
      <!-- Accent + mode -->
      <div class="flex items-center gap-6 flex-wrap">
        <div class="flex items-center gap-3">
          <label class="relative w-12 h-12 rounded-full overflow-hidden cursor-pointer shrink-0" style="background: {accent}; box-shadow: 0 0 0 4px color-mix(in srgb, {accent} 20%, transparent);">
            <input type="color" bind:value={accent} class="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
          <div class="flex flex-col">
            <span class="text-sm font-medium tabular-nums" style="color: var(--text-primary);">{accent.toUpperCase()}</span>
            <span class="text-xs" style="color: var(--text-muted);">Click swatch</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {#each [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }] as m}
            <button
              type="button"
              on:click={() => (mode = m.id)}
              class="px-4 py-2 rounded-md text-sm transition-colors"
              style="background: {mode === m.id ? 'var(--text-primary)' : 'var(--bg)'}; color: {mode === m.id ? 'var(--bg)' : 'var(--text-primary)'}; border: 1px solid {mode === m.id ? 'var(--text-primary)' : 'var(--border)'}; cursor: pointer;"
            >{m.label}</button>
          {/each}
        </div>
      </div>

      <!-- Live preview -->
      <div class="space-y-2">
        <span class="text-xs uppercase tracking-wide" style="color: var(--text-muted);">Preview</span>
        <div class="rounded-xl overflow-hidden" style="border: 1px solid var(--border);">
          <div class="p-6 flex flex-col items-center gap-3 text-center" style="{paletteStyle} background: var(--p-bg); color: var(--p-text);">
            {#if avatarUrl}
              <img src={avatarUrl} alt="" class="w-14 h-14 rounded-full object-cover" style="border: 1px solid var(--p-border);" />
            {:else}
              <div class="w-14 h-14 rounded-full flex items-center justify-center text-base font-medium" style="background: var(--p-surface); border: 1px solid var(--p-border); color: var(--p-muted);">
                {previewInitial}
              </div>
            {/if}

            <div class="space-y-0.5">
              <div class="text-base font-semibold tracking-tight leading-none">{previewName}</div>
              {#if data.user.handle}
                <div class="text-xs" style="color: var(--p-muted);">@{data.user.handle}</div>
              {/if}
            </div>

            {#if bio}
              <p class="text-xs leading-relaxed max-w-xs" style="color: var(--p-muted);">{bio}</p>
            {/if}

            <div class="w-full max-w-xs space-y-1.5 pt-2">
              {#each sampleRows as r}
                <div class="w-full px-3 py-2 rounded-lg text-xs font-medium" style="background: var(--p-surface); border: 1px solid var(--p-border);">
                  {r}
                </div>
              {/each}
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
