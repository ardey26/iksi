<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { Button, Input, Textarea } from '#lib/ui/index.js';
  import { DISCLOSE_MS, autoHeight, easeOut, motion } from '#lib/ui/motion.js';
  import { PASSWORD_MAX } from '#lib/password-limits.js';
  import {
    ONE_TIME_TEXT_MAX,
    ONE_TIME_TTL_DAYS,
    createOneTimeLink,
    oneTimeContentValid
  } from '#lib/one-time.js';

  /**
   * Home page create form for a one-time (burn after reading) link. The URL
   * or Text choice lives in the page's mode row, so the first field sits
   * exactly where the short link field does and switching moves nothing.
   */

  export let inputRef = null;
  /** 'url' | 'text', chosen by the page. */
  export let kind = 'url';

  const dispatch = createEventDispatcher();
  const MAX_LABEL = ONE_TIME_TEXT_MAX.toLocaleString('en-US');

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
    // No scroll: the field is still sliding open inside a clipped box.
    passwordRef?.focus({ preventScroll: true });
  }

  // Closing drops the password, so a hidden one is never sent.
  function removePassword() {
    withPassword = false;
    password = '';
  }

  const togglePassword = () => (withPassword ? removePassword() : addPassword());

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
  <!-- Text is taller than URL: the box eases to its new height, so what is
       below glides down and nothing above moves. -->
  <div class="content" use:autoHeight>
    <div>
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
    </div>
  </div>

  <!-- Reserved, so an error never moves the button. -->
  <div class="status" aria-live="polite">
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>

  <!-- The toggle stays put and the password opens under this row. -->
  <div class="actions">
    <Button
      variant="ghost"
      size="sm"
      icon="plus"
      class="flush disclose"
      aria-expanded={withPassword}
      aria-controls="one-time-password"
      on:click={togglePassword}
    >
      Add a password
    </Button>
    <div class="panel" id="one-time-password">
      {#if withPassword}
        <div class="password" transition:slide={motion({ duration: DISCLOSE_MS, easing: easeOut })}>
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
          />
        </div>
      {/if}
    </div>
    <div class="submit">
      <Button type="submit" variant="primary" disabled={!canSubmit && !isLoading} loading={isLoading}>
        Create one-time link
      </Button>
    </div>
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
  /* Exactly one line, so the buttons never move. */
  .status {
    height: 20px;
    margin: -4px 0;
  }
  .error {
    margin: 0;
    overflow: hidden;
    font-size: 13px;
    line-height: 20px;
    color: var(--error);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Row one: toggle left, submit right. Row two: the password, which slides
     open downward, so nothing in row one moves. */
  .actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'toggle submit'
      'panel panel';
    align-items: center;
    column-gap: 12px;
  }
  .actions > :global(.disclose) { grid-area: toggle; justify-self: start; }
  .submit { grid-area: submit; }
  .panel { grid-area: panel; }
  .password { padding-top: 12px; }
  /* Narrowest phones: both buttons do not fit on one row, so the create
     button takes its own row and the toggle sits under it. Still nothing
     above the toggle moves when it opens the password. */
  @media (max-width: 359px) {
    .actions {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        'submit'
        'toggle'
        'panel';
      row-gap: 8px;
    }
    .submit :global(.btn) { width: 100%; }
  }
  .actions :global(.flush) { margin-left: -10px; }
  .actions :global(.disclose .ui-icon) { transition: transform var(--duration-normal) var(--ease-out); }
  .actions :global(.disclose[aria-expanded='true'] .ui-icon) { transform: rotate(45deg); }
  @media (prefers-reduced-motion: reduce) {
    .actions :global(.disclose .ui-icon) { transition: none; }
  }
  .note {
    margin: 4px 0 0;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
</style>
