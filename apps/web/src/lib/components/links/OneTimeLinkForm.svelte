<script lang="ts">
  // Dashboard create form for a one-time (burn after reading) link. The page
  // puts it in its "One-time links" section.
  import { createEventDispatcher } from 'svelte';
  import { Button, Field, IconButton, Input, Paper, Segmented, Stack, Textarea } from '#lib/ui/index.js';
  import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
  import { ONE_TIME_TEXT_MAX, createOneTimeLink, oneTimeContentValid, type OneTimeKind } from '#lib/one-time.js';
  import { formatCount } from '#lib/format.js';

  const dispatch = createEventDispatcher<{ created: Record<string, unknown> }>();
  const MAX_LABEL = formatCount(ONE_TIME_TEXT_MAX);

  let kind: OneTimeKind = 'url';
  let url = '';
  let text = '';
  let password = '';
  let reveal = false;
  let busy = false;
  let error = '';
  let passwordError = '';

  $: content = kind === 'url' ? url : text;
  $: canCreate = oneTimeContentValid(kind, content);

  async function create() {
    if (!canCreate || busy) return;
    passwordError = '';
    if (password !== '' && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      passwordError = `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`;
      return;
    }
    busy = true;
    error = '';
    const result = await createOneTimeLink({
      kind,
      content: kind === 'url' ? url.trim() : text,
      password: password || undefined
    });
    busy = false;
    if (!result.ok || !result.link) {
      error = result.ok ? 'Something went wrong' : result.error;
      return;
    }
    url = '';
    text = '';
    password = '';
    dispatch('created', result.link);
  }
</script>

<Paper as="form" on:submit={(e) => { e.preventDefault(); create(); }}>
  <Stack gap={16}>
    <Field label="Content" group reserve={false} let:labelId>
      <Segmented
        labelledby={labelId}
        bind:value={kind}
        on:change={() => (error = '')}
        options={[
          { value: 'url', label: 'URL', icon: 'link' },
          { value: 'text', label: 'Text' }
        ]}
      />
    </Field>

    {#if kind === 'url'}
      <Input
        label="Link to share"
        icon="link"
        inputmode="url"
        maxlength="2048"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://example.com/private"
        hint="Visitors go here once. https:// is added if missing."
        {error}
        bind:value={url}
      />
    {:else}
      <Textarea label="Message" rows={4} maxlength={ONE_TIME_TEXT_MAX} {error} bind:value={text}>
        <span slot="aside" class="t-caption t-muted t-tabular" aria-live="polite">{formatCount(text.length)} / {MAX_LABEL}</span>
      </Textarea>
    {/if}

    <Input
      label="Password"
      optional
      type={reveal ? 'text' : 'password'}
      autocomplete="new-password"
      maxlength={PASSWORD_MAX}
      placeholder="Not set"
      hint="Asked before it opens."
      error={passwordError}
      bind:value={password}
    >
      <IconButton
        slot="end"
        icon={reveal ? 'eye-off' : 'eye'}
        label={reveal ? 'Hide password' : 'Show password'}
        on:click={() => (reveal = !reveal)}
      />
    </Input>

    <div class="foot">
      <Button type="submit" variant="secondary" icon="lock" loading={busy} disabled={!canCreate}>Create one-time link</Button>
    </div>
  </Stack>
</Paper>

<style>
  .foot {
    display: flex;
    justify-content: flex-end;
  }
  @media (max-width: 639px) {
    .foot > :global(*) { width: 100%; }
  }
</style>
