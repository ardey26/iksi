<script>
  import { createEventDispatcher } from 'svelte';
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
  let isLoading = false;
  let error = '';

  $: content = kind === 'url' ? url : text;
  $: canSubmit = oneTimeContentValid(kind, content) && !isLoading;

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

<form on:submit|preventDefault={submit} class="space-y-4">
  <div class="h-5">
    {#if error}
      <p class="text-sm fade-in" style="color: var(--error);" role="alert">{error}</p>
    {/if}
  </div>

  <div class="seg" role="radiogroup" aria-label="Content">
    <label class="key" class:on={kind === 'url'}>
      <input type="radio" name="one-time-kind" value="url" bind:group={kind} />
      <span>URL</span>
    </label>
    <label class="key" class:on={kind === 'text'}>
      <input type="radio" name="one-time-kind" value="text" bind:group={kind} />
      <span>Text</span>
    </label>
  </div>

  {#if kind === 'url'}
    <input
      bind:this={inputRef}
      type="text"
      inputmode="url"
      bind:value={url}
      placeholder="Paste a link"
      maxlength="2048"
      autocomplete="off"
      class="field w-full outline-none py-4 px-5 text-lg rounded-xl"
      aria-label="URL to share once"
    />
  {:else}
    <div>
      <textarea
        bind:value={text}
        placeholder="Type or paste what to share"
        maxlength={ONE_TIME_TEXT_MAX}
        rows="5"
        class="field w-full outline-none py-4 px-5 text-lg rounded-xl"
        aria-label="Text to share once"
        aria-describedby="one-time-count"
      ></textarea>
      <p id="one-time-count" class="count text-sm text-right" aria-live="polite">
        {text.length.toLocaleString('en-US')} / {MAX_LABEL}
      </p>
    </div>
  {/if}

  <div class="flex items-center" style="min-height: 44px;">
    {#if withPassword}
      <div class="chip flex items-center rounded-lg w-full">
        <input
          type="password"
          bind:value={password}
          placeholder="Password"
          maxlength={PASSWORD_MAX}
          autocomplete="new-password"
          class="flex-1 min-w-0 px-3 text-sm bg-transparent outline-none"
          style="color: var(--text-primary); height: 100%;"
          aria-label="Password"
        />
        <button
          type="button"
          class="flex items-center justify-center flex-shrink-0"
          style="width: 44px; height: 100%; color: var(--text-muted);"
          on:click={() => { withPassword = false; password = ''; }}
          aria-label="Remove password"
          title="Remove password"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {:else}
      <button
        type="button"
        class="text-sm transition-colors hover:underline"
        style="color: var(--text-muted);"
        on:click={() => (withPassword = true)}
      >
        Add a password
      </button>
    {/if}
  </div>

  <button
    type="submit"
    disabled={!canSubmit}
    class="submit w-full text-base font-medium rounded-xl"
  >
    {#if isLoading}
      <span class="spinner" aria-hidden="true"></span>
      <span class="sr-only">Creating</span>
    {:else}
      Create one-time link
    {/if}
  </button>

  <p class="text-sm" style="color: var(--text-muted);">
    It opens once, then it is gone. Unopened links expire in {ONE_TIME_TTL_DAYS} days.
  </p>

  <div class="flex items-center" style="min-height: 44px;">
    <button
      type="button"
      class="text-sm transition-colors hover:underline"
      style="color: var(--text-muted);"
      on:click={() => dispatch('cancel')}
    >
      Back to a regular link
    </button>
  </div>
</form>

<style>
  .seg {
    display: inline-flex;
    height: 44px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--surface);
  }
  .key {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
    padding: 0 16px;
    font-size: 14px;
    color: var(--text-muted);
    cursor: pointer;
  }
  .key + .key {
    border-left: 1px solid var(--border);
  }
  .key.on {
    color: var(--bg);
    background-color: var(--text-primary);
  }
  .key input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .key:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .field {
    display: block;
    color: var(--text-primary);
    background-color: var(--surface);
    border: 1px solid var(--border);
    min-height: 60px;
    transition: border-color var(--duration-normal) var(--ease-out);
  }
  textarea.field {
    resize: vertical;
    line-height: 1.5;
  }
  .field:focus {
    border-color: var(--accent);
  }
  textarea.field::placeholder {
    color: var(--text-muted);
    opacity: 0.5;
  }
  .count {
    min-height: 20px;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
  .chip {
    height: 44px;
    background-color: var(--surface);
    border: 1px solid var(--border);
  }
  .chip:focus-within {
    border-color: var(--accent);
  }
  .submit {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    color: var(--bg);
    background-color: var(--accent);
    border: none;
    cursor: pointer;
  }
  .submit:not(:disabled):active {
    transform: scale(0.98);
  }
  .submit:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
