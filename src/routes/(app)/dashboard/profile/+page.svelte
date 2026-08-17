<script lang="ts">
  export let data;

  let displayName = data.profile?.displayName ?? '';
  let bio = data.profile?.bio ?? '';
  let avatarUrl = data.profile?.avatarUrl ?? '';
  let theme = data.profile?.theme ?? 'default';
  let accent = data.profile?.accent ?? '#3B82F6';

  let saving = false;
  let saved = false;
  let dirty = false;

  $: {
    const orig = {
      displayName: data.profile?.displayName ?? '',
      bio: data.profile?.bio ?? '',
      avatarUrl: data.profile?.avatarUrl ?? '',
      theme: data.profile?.theme ?? 'default',
      accent: data.profile?.accent ?? '#3B82F6'
    };
    dirty = displayName !== orig.displayName || bio !== orig.bio || avatarUrl !== orig.avatarUrl
      || theme !== orig.theme || accent !== orig.accent;
  }

  async function saveProfile() {
    if (!dirty || saving) return;
    saving = true;
    const res = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateProfile', displayName, bio, avatarUrl, theme, accent })
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

  const themes = [
    { id: 'default', label: 'Dark' },
    { id: 'light', label: 'Light' },
    { id: 'mono', label: 'Mono' }
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
      <p class="text-sm mt-1" style="color: var(--text-muted);">Look and feel of your public page.</p>
    </div>
    <div class="rounded-xl p-6 space-y-6" style="background: var(--surface); border: 1px solid var(--border);">
      <div class="space-y-3">
        <span class="text-sm" style="color: var(--text-muted);">Theme</span>
        <div class="flex gap-2">
          {#each themes as t}
            <button
              type="button"
              on:click={() => theme = t.id}
              class="flex-1 py-2.5 rounded-md text-sm transition-colors"
              style="background: {theme === t.id ? 'var(--text-primary)' : 'var(--bg)'}; color: {theme === t.id ? 'var(--bg)' : 'var(--text-primary)'}; border: 1px solid {theme === t.id ? 'var(--text-primary)' : 'var(--border)'}; cursor: pointer;"
            >{t.label}</button>
          {/each}
        </div>
      </div>

      <div class="flex items-center gap-4">
        <span class="text-sm" style="color: var(--text-muted);">Accent</span>
        <label class="relative w-10 h-10 rounded-full overflow-hidden cursor-pointer" style="background: {accent}; border: 1px solid var(--border);">
          <input type="color" bind:value={accent} class="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <span class="text-sm tabular-nums" style="color: var(--text-muted);">{accent.toUpperCase()}</span>
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
