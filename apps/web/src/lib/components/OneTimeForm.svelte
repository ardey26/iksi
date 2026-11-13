<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { Button } from '#lib/ui/index.js';
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
   * or Text choice lives in the page's mode row, so the bar sits exactly
   * where the short link's does and switching moves nothing above it.
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
  /** Read by the page, so the wordmark can show the wait too. */
  export let isLoading = false;
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
  <div use:autoHeight>
    <div>
      {#if kind === 'url'}
        <div class="pill-bar">
          <label class="sr-only" for="one-time-url">URL to share once</label>
          <input
            bind:value={url}
            bind:this={inputRef}
            data-ui
            class="pill-native"
            id="one-time-url"
            type="text"
            inputmode="url"
            placeholder="Paste a link that opens once"
            maxlength="2048"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <Button type="submit" variant="primary" size="lg" disabled={!canSubmit && !isLoading} loading={isLoading} aria-label="Create one-time link">
            Create
          </Button>
        </div>
      {:else}
        <div class="pill-bar box">
          <label class="sr-only" for="one-time-text">Text to share once</label>
          <textarea
            bind:value={text}
            bind:this={inputRef}
            data-ui
            class="pill-native"
            id="one-time-text"
            rows="4"
            placeholder="Type or paste what to share"
            maxlength={ONE_TIME_TEXT_MAX}
          ></textarea>
          <div class="box-foot">
            <p class="count t-caption t-tabular" aria-live="polite">{text.length.toLocaleString('en-US')} / {MAX_LABEL}</p>
            <Button type="submit" variant="primary" size="lg" disabled={!canSubmit && !isLoading} loading={isLoading} aria-label="Create one-time link">
              Create
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- The toggle stays put and the password opens under it. -->
  <div class="pill-toggle">
    <Button
      variant="ghost"
      size="sm"
      icon="plus"
      class="disclose"
      aria-expanded={withPassword}
      aria-controls="one-time-password"
      on:click={togglePassword}
    >
      Add a password
    </Button>
  </div>
  <div id="one-time-password">
    {#if withPassword}
      <div class="password" transition:slide={motion({ duration: DISCLOSE_MS, easing: easeOut })}>
        <div class="pill-bar sub">
          <label class="sr-only" for="one-time-password-input">Password</label>
          <input
            bind:value={password}
            bind:this={passwordRef}
            data-ui
            class="pill-native"
            id="one-time-password-input"
            type="password"
            placeholder="Password"
            maxlength={PASSWORD_MAX}
            autocomplete="new-password"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- The one line at the end: what a one-time link does, or what went wrong. -->
  <p class="note pill-status" aria-live="polite">
    {#if error}
      <span class="error" role="alert">{error}</span>
    {:else}
      It opens once, then it is gone. Unopened links expire in {ONE_TIME_TTL_DAYS} days.
    {/if}
  </p>
</form>

<style>
  .one-time {
    display: flex;
    flex-direction: column;
  }
  .box-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .count {
    margin: 0;
    color: var(--text-faint);
  }
  /* The gap lives inside the sliding element, so it opens with it. */
  .password { padding-bottom: 12px; }
  .note { color: var(--text-muted); }
  .error { color: var(--error); }
</style>
