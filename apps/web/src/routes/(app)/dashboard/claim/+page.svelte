<script lang="ts">
  import { Button, Container, Field, PageHeader, Paper, Stack } from '#lib/ui/index.js';
  import { HANDLE_ERRORS, HANDLE_MAX, handleShapeError } from '#lib/handle-rules.js';

  export let data;

  // What the field keeps as you type. Underscores stay, so the field can say
  // why they cannot be used instead of dropping them silently.
  function sanitize(v: string) {
    return v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, HANDLE_MAX);
  }

  // The suggestion from the account is made claimable: anything else
  // becomes a hyphen ("ann_reyes" from X is offered as "ann-reyes").
  function suggestionOf(v: string) {
    return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, HANDLE_MAX).replace(/-+$/, '');
  }

  const suggested = data.user.twitterHandle ?? (data.user.googleEmail?.split('@')[0] ?? '');
  let handle = suggestionOf(suggested);
  let error = '';
  let loading = false;

  $: problem = handleShapeError(handle);
  $: valid = problem === null;
  // Say what is wrong with what was typed; a handle that is only too short
  // is still being typed, and the disabled button and the hint cover it.
  $: shown = error || (problem === HANDLE_ERRORS.chars || problem === HANDLE_ERRORS.hyphen ? problem : '');

  function onInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    handle = sanitize(el.value);
    // Keep the field showing only what is kept.
    if (el.value !== handle) el.value = handle;
    error = '';
  }

  async function submit() {
    if (!valid || loading) return;
    loading = true;
    error = '';
    try {
      const res = await fetch('/dashboard/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });
      const body = await res.json();
      if (body.ok) window.location.href = '/dashboard';
      else error = body.error || 'Could not claim';
    } catch {
      error = 'Something went wrong.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Claim your handle — iksi</title></svelte:head>

<Container width="narrow" class="claim">
  <PageHeader title="Claim your handle" description="It's the address of your public page." />

  <Paper as="form" on:submit={(e) => { e.preventDefault(); submit(); }}>
    <Stack gap={16}>
      <Field
        label="Handle"
        error={shown}
        hint="3 to 30 characters: lowercase letters, numbers and hyphens."
        let:id
        let:describedby
        let:invalid
      >
        <div class="ui-box" data-invalid={invalid || undefined}>
          <span class="ui-affix">iksi.app/@</span>
          <input
            data-ui
            class="ui-native"
            {id}
            type="text"
            value={handle}
            on:input={onInput}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            required
            minlength="3"
            maxlength="30"
            placeholder="handle"
            aria-describedby={describedby}
            aria-invalid={invalid || undefined}
          />
        </div>
      </Field>

      <Button type="submit" variant="primary" size="lg" full {loading} disabled={!valid}>
        Claim @{handle || 'handle'}
      </Button>
    </Stack>
  </Paper>
</Container>

<style>
  /* Onboarding sits a little lower than app pages. */
  :global(.claim) { padding-top: 24px; }
  /* The prefix reads as one address with the typed handle. */
  .ui-box > .ui-affix { color: var(--text-muted); margin-right: -8px; }
</style>
