<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { Button, IconButton, Input, Segmented, Textarea } from '#lib/ui/index.js';
  import { PASSWORD_MAX } from '#lib/password-limits.js';
  import {
    ONE_TIME_TEXT_MAX,
    ONE_TIME_TTL_DAYS,
    createOneTimeLink,
    oneTimeContentValid
  } from '#lib/one-time.js';

  /** Home page create form for a one-time (burn after reading) link. */

  export let inputRef = null;

  const dispatch = createEventDispatcher();
  const MAX_LABEL = ONE_TIME_TEXT_MAX.toLocaleString('en-US');

  let kind = 'url';
  let url = '';
  let text = '';
  let withPassword = false;
  let password = '';
  let passwordRef = null;
  let isLoading = false;
  let error = '';

  $: content = kind === 'url' ? url : text;
  $: canSubmit = oneTimeContentValid(kind, content) && !isLoading;

  async function addPassword() {
    withPassword = true;
    await tick();
    passwordRef?.focus();
  }

  async function removePassword() {
    withPassword = false;
    password = '';
    await tick();
    inputRef?.focus();
  }

  async function submit() {
    if (!canSubmit) return;
    isLoading = true;
    error = '';
    const result = await createOneTimeLink({
      kind,
      content: kind === 'url' ? url.trim() : text,
      password: withPassword ? password : undefined
    });
    if (result.ok) {
      dispatch('created', { shortURL: result.shortURL });
      return;
    }
    error = result.error;
    isLoading = false;
  }
</script>

<form on:submit|preventDefault={submit} class="one-time">
  <Segmented
    size="sm"
    label="Content"
    bind:value={kind}
    options={[
      { value: 'url', label: 'URL' },
      { value: 'text', label: 'Text' }
    ]}
  />

  {#if kind === 'url'}
    <Input
      bind:value={url}
      bind:element={inputRef}
      label="URL to share once"
      hideLabel
      reserve={false}
      icon="link"
      inputmode="url"
      placeholder="Paste a link"
      maxlength="2048"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
  {:else}
    <div class="text">
      <Textarea
        bind:value={text}
        label="Text to share once"
        hideLabel
        reserve={false}
        rows={4}
        placeholder="Type or paste what to share"
        maxlength={ONE_TIME_TEXT_MAX}
      />
      <p class="count t-caption t-tabular" aria-live="polite">{text.length.toLocaleString('en-US')} / {MAX_LABEL}</p>
    </div>
  {/if}

  {#if withPassword}
    <Input
      bind:value={password}
      bind:element={passwordRef}
      type="password"
      label="Password"
      hideLabel
      reserve={false}
      icon="lock"
      placeholder="Password"
      maxlength={PASSWORD_MAX}
      autocomplete="new-password"
    >
      <IconButton slot="end" icon="x" label="Remove password" on:click={removePassword} />
    </Input>
  {/if}

  <!-- Reserved, so an error never moves the button. -->
  <div class="status" aria-live="polite">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>

  <div class="actions">
    {#if withPassword}
      <span></span>
    {:else}
      <Button variant="ghost" size="sm" icon="plus" class="flush" on:click={addPassword}>Add a password</Button>
    {/if}
    <Button type="submit" variant="primary" disabled={!canSubmit && !isLoading} loading={isLoading}>
      Create one-time link
    </Button>
  </div>

  <p class="note t-caption t-muted">
    It opens once, then it is gone. Unopened links expire in {ONE_TIME_TTL_DAYS} days.
  </p>
</form>

<style>
  .one-time {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .text { position: relative; }
  .count {
    margin: 6px 0 0;
    text-align: right;
    color: var(--text-faint);
  }
  .status {
    min-height: 20px;
    margin: -4px 0;
  }
  .error {
    margin: 0;
    font-size: 13px;
    line-height: 20px;
    color: var(--error);
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .actions :global(.flush) { margin-left: -10px; }
  .note {
    margin: 4px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
</style>
