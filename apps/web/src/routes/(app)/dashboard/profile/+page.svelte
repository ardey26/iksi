<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import ImageUpload from '#lib/components/ImageUpload.svelte';
  import PaymentMethods from '#lib/components/PaymentMethods.svelte';
  import { Button, Container, Field, Input, PageHeader, Paper, Section, Stack, Switch, Textarea, toast } from '#lib/ui/index.js';
  import { uid } from '#lib/ui/uid.js';
  import { profileLabel } from '#lib/subdomains.js';

  export let data;

  const ids = { scope: uid('scope'), scopeDesc: uid('scope-desc') };

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
  let dirty = false;

  $: {
    const orig = {
      displayName: data.profile?.displayName ?? '',
      bio: data.profile?.bio ?? '',
      avatarUrl: savedAvatarUrl,
      accent: data.profile?.accent ?? '#3B82F6',
      brightness: themeToBrightness(data.profile?.theme)
    };
    dirty = displayName !== orig.displayName || bio !== orig.bio || avatarUrl !== orig.avatarUrl
      // The color input reports lowercase hex; case is not a change.
      || accent.toLowerCase() !== orig.accent.toLowerCase() || brightness !== orig.brightness;
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
    }).catch(() => null);
    saving = false;
    if (res?.ok) {
      // Server may have normalized the avatar URL (e.g. Google Drive rewrite);
      // reflect that back into the input.
      const body = await res.json().catch(() => ({}));
      if (typeof body.avatarUrl === 'string' || body.avatarUrl === null) {
        avatarUrl = body.avatarUrl ?? '';
      }
      savedAvatarUrl = avatarUrl;
      toast('Profile saved', { variant: 'success' });
      await invalidateAll();
    } else {
      const body = res ? await res.json().catch(() => ({})) : {};
      toast(body.error || 'Could not save your profile', { variant: 'error' });
    }
  }

  // "Use my handle for custom names" saves on its own, like Payments.
  let scopeCustomNames: boolean = data.scopeCustomNames ?? false;
  let scopeSaving = false;
  let scopeError = '';
  async function toggleScope() {
    if (scopeSaving) return;
    const on = scopeCustomNames;
    scopeSaving = true;
    scopeError = '';
    const ok = await fetch('/dashboard/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setScopeCustomNames', on })
    }).then((r) => r.ok, () => false);
    scopeSaving = false;
    if (!ok) {
      scopeCustomNames = !on;
      scopeError = 'Could not save. Try again.';
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

  $: placeholderName = data.user.twitterHandle ?? data.user.googleEmail?.split('@')[0] ?? 'Your name';
  $: previewName = displayName || data.user.twitterHandle || data.user.googleEmail?.split('@')[0] || 'You';
  $: previewHandle = data.user.handle || data.user.twitterHandle || 'you';
  function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toLowerCase();
    return (parts[0][0] + parts[1][0]).toLowerCase();
  }
  const sampleRows = ['Website', 'Latest post', 'Newsletter'];
</script>

<svelte:head><title>Profile — iksi</title></svelte:head>

<Container width="wide">
  <PageHeader back="/dashboard" backLabel="Dashboard" title="Profile" description="How your public page looks, and how people pay you.">
    <svelte:fragment slot="actions">
      {#if data.user.handle}
        <Button icon="external" href={`/@${data.user.handle}`} target="_blank" rel="noopener">View page</Button>
      {/if}
    </svelte:fragment>
  </PageHeader>

  <div class="layout">
    <div class="edit">
      <Section title="Identity" description="How you show up on your public page.">
        <Paper>
          <Stack gap={20}>
            <Field label="Avatar" group reserve={false}>
              <ImageUpload kind="avatar" value={avatarUrl || null} savedUrl={savedAvatarUrl || null} on:change={onAvatarChange}>
                <Button size="sm" variant="ghost" aria-expanded={showUrlInput} aria-controls="p-avatar-url" on:click={() => (showUrlInput = !showUrlInput)}>
                  Paste a URL instead
                </Button>
              </ImageUpload>
              {#if showUrlInput}
                <div class="avatar-url">
                  <Input id="p-avatar-url" label="Avatar URL" hideLabel inputmode="url" placeholder="https://..." reserve={false} bind:value={avatarUrl} />
                </div>
              {/if}
            </Field>

            <Input label="Display name" maxlength="80" placeholder={placeholderName} reserve={false} bind:value={displayName} />

            <Textarea label="Bio" maxlength="200" rows={3} placeholder="A line or two about you." reserve={false} bind:value={bio}>
              <span slot="aside" class="t-caption t-muted t-tabular">{bio.length} of 200</span>
            </Textarea>
          </Stack>
        </Paper>
      </Section>

      <Section title="Appearance" description="Pick a color and a brightness. The palette is derived from both.">
        <Paper>
          <Stack gap={20}>
            <Field label="Accent" group reserve={false} let:labelId>
              <div class="inline">
                <label class="swatch" style="background-color: {accent};">
                  <input type="color" bind:value={accent} aria-label="Accent color" aria-describedby={labelId} />
                </label>
                <span class="t-readout t-mono">{accent.toUpperCase()}</span>
              </div>
            </Field>

            <Field label="Brightness" group reserve={false} let:labelId>
              <div class="inline">
                <span class="t-caption t-muted">Dark</span>
                <input type="range" min="0" max="100" step="1" bind:value={brightness} class="slider" aria-label="Palette brightness" aria-describedby={labelId} />
                <span class="t-caption t-muted">Light</span>
                <span class="t-readout readout">{Math.round(brightness)}</span>
              </div>
            </Field>

            <Field label="Background" group reserve={false}>
              <ImageUpload kind="background" value={backgroundUrl} on:change={onBackgroundChange} />
            </Field>
          </Stack>
        </Paper>
      </Section>

      <div class="save">
        <Paper padding="sm">
          <div class="save-row">
            <p class="t-label" class:t-muted={!dirty}>{dirty ? 'Unsaved changes' : 'Identity and appearance save together.'}</p>
            <Button variant="primary" loading={saving} disabled={!dirty} on:click={saveProfile}>Save changes</Button>
          </div>
        </Paper>
      </div>
    </div>

    <aside class="preview" aria-labelledby="p-preview">
      <h2 id="p-preview" class="t-title">Preview</h2>
      <p class="t-body t-muted lede">Your public page with these settings.</p>
      <div class="stage" style="{paletteStyle} background-color: var(--p-bg);{backgroundUrl ? ` background-image: url('${backgroundUrl}'); background-size: cover; background-position: center;` : ''}">
        <div class="card">
          <div class="card-head">
            {#if avatarUrl}
              <img src={avatarUrl} alt="" class="avatar" />
            {:else}
              <div class="avatar initials" style="background: oklch(from {accent} 0.90 max(c, 0.08) h); color: var(--p-accent-text);">{initials(previewName)}</div>
            {/if}
            <div class="who">
              <div class="name">{previewName}</div>
              <div class="handle">{profileLabel(previewHandle, !!data.subdomains)}</div>
            </div>
            <span class="pill">Copy</span>
          </div>
          {#if bio}<p class="bio">{bio}</p>{/if}
          {#each sampleRows as row}
            <div class="sample">{row}</div>
          {/each}
          <p class="foot">{previewHandle} shortens links with <span>iksi</span></p>
        </div>
      </div>
    </aside>

    <div class="rest">
      {#if data.payments}
        <PaymentMethods methods={data.payments.methods} label={data.payments.label} />
      {/if}

      <Section title="Short links" description="Changes save right away.">
        <Paper>
          <div class="setting">
            <div class="setting-text">
              <p id={ids.scope} class="t-body t-primary setting-title">Use my handle for custom names</p>
              <p id={ids.scopeDesc} class="t-label t-muted">New custom names go under iksi.app/@{data.user.handle}. Links with a random name stay as they are.</p>
              <p class="t-label t-mono example">iksi.app/{scopeCustomNames ? `@${data.user.handle}/` : ''}name</p>
            </div>
            <Switch labelledby={ids.scope} describedby={ids.scopeDesc} disabled={scopeSaving} bind:checked={scopeCustomNames} on:change={toggleScope} />
          </div>
          <p class="t-caption scope-error" role={scopeError ? 'alert' : undefined}>{scopeError}</p>
        </Paper>
      </Section>
    </div>
  </div>
</Container>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'edit' 'preview' 'rest';
    row-gap: 48px;
  }
  .edit { grid-area: edit; min-width: 0; }
  .rest { grid-area: rest; min-width: 0; }
  .preview { grid-area: preview; min-width: 0; }
  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 320px;
      grid-template-areas: 'edit preview' 'rest preview';
      grid-template-rows: auto 1fr;
      column-gap: 48px;
    }
    .preview {
      position: sticky;
      top: 96px;
      align-self: start;
    }
  }

  .avatar-url { margin-top: 12px; }
  .inline {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
  }
  .swatch {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    cursor: pointer;
  }
  .swatch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .swatch:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* A pill track with a round white thumb, like the kit's Switch. */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    flex: 1 1 auto;
    min-width: 0;
    height: 24px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background-color: var(--switch-off);
  }
  .slider::-moz-range-track {
    height: 4px;
    border-radius: 999px;
    background-color: var(--switch-off);
  }
  .slider::-moz-range-progress {
    height: 4px;
    border-radius: 999px;
    background-color: var(--text-primary);
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    margin-top: -7px;
    background-color: #ffffff;
    border: 0;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3), 0 0 0 1px rgb(0 0 0 / 0.06);
  }
  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background-color: #ffffff;
    border: 0;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.3), 0 0 0 1px rgb(0 0 0 / 0.06);
  }
  .slider:focus { outline: none; }
  .slider:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
  .slider:focus-visible::-moz-range-thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 639px) {
    /* 44px touch targets on phones. */
    .swatch { width: 44px; height: 44px; }
    .slider { height: 44px; }
  }
  .readout {
    width: 28px;
    text-align: right;
    color: var(--text-primary);
  }

  .save {
    position: sticky;
    bottom: 16px;
    z-index: 5;
    margin-top: 24px;
  }
  .save :global(.paper) { box-shadow: var(--overlay-shadow); }
  .save-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-left: 4px;
  }
  .save-row p { margin: 0; }

  .setting {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .setting-text p { margin: 0; }
  .setting-title { font-weight: 500; }
  .example {
    margin-top: 8px !important;
    color: var(--text-primary);
  }
  .scope-error {
    min-height: 16px;
    margin: 8px 0 -8px;
    color: var(--error);
  }

  .preview h2 { margin: 0; }
  .lede { margin: 4px 0 16px; }
  .stage {
    padding: 24px;
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
  }
  .card {
    overflow: hidden;
    color: var(--p-text);
    background: var(--p-surface);
    border: 1px solid var(--p-border);
    border-radius: 16px;
    box-shadow:
      0 16px 40px -14px oklch(from var(--accent) 0.15 0.08 h / 0.35),
      0 4px 14px -4px oklch(from var(--accent) 0.15 0.04 h / 0.18);
  }
  .card-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }
  .avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--p-border);
    border-radius: 50%;
    object-fit: cover;
  }
  .initials {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    border: 0;
  }
  .who { flex: 1; min-width: 0; }
  .name,
  .handle {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .name {
    font-size: 14px;
    line-height: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .handle {
    margin-top: 2px;
    font-size: 12px;
    color: var(--p-accent-text);
  }
  .pill {
    flex: none;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 500;
    color: var(--p-bg);
    background: var(--p-text);
    border-radius: 999px;
  }
  .bio {
    margin: 0;
    padding: 0 16px 16px;
    font-size: 14px;
    line-height: 18px;
    font-weight: 500;
  }
  .sample {
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    border-top: 1px solid var(--p-border);
  }
  .foot {
    margin: 0;
    padding: 8px 16px 12px;
    font-size: 12px;
    text-align: center;
    color: var(--p-muted);
  }
  .foot span {
    color: var(--p-text);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
