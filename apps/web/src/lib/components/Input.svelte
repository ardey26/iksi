<script>
  import { isValidURL, isValidAlias } from '../utils/urlValidation.js';

  export let longURL = '';
  export let customURL = '';
  export let showCustomAlias = false;
  export let isLoading = false;
  export let error = '';
  export let handleSubmit;
  export let inputRef = null;

  // Compact variant: dashboard-embedded (no reserved error space, alias always shown, tighter type).
  export let compact = false;

  let shakeInput = false;
  let shakeAlias = false;

  $: isURLValid = longURL ? isValidURL(longURL) : false;
  $: isAliasValid = customURL ? isValidAlias(customURL) : true;
  $: canSubmit = longURL && isURLValid && isAliasValid && !isLoading;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        longURL = text;
        if (inputRef) inputRef.focus();
      }
    } catch (err) {
      console.error('Clipboard access denied');
    }
  };

  const clearInput = () => {
    longURL = '';
    if (inputRef) inputRef.focus();
  };

  const triggerShake = (target) => {
    if (target === 'input') {
      shakeInput = true;
      setTimeout(() => { shakeInput = false; }, 200);
    } else {
      shakeAlias = true;
      setTimeout(() => { shakeAlias = false; }, 200);
    }
  };

  const submit = (e) => {
    e?.preventDefault();

    if (!longURL) return;

    if (!isURLValid) {
      triggerShake('input');
      return;
    }

    if (showCustomAlias && !isAliasValid) {
      triggerShake('alias');
      return;
    }

    handleSubmit();
  };

  const handleKeydown = (e) => {
    if (e.key === 'Enter' && canSubmit) {
      submit();
    }
  };
</script>

<form on:submit|preventDefault={submit} class:space-y-3={compact} class:space-y-4={!compact}>
  <!-- Error message space (reserved on default; inline-only on compact so parent controls layout) -->
  {#if !compact}
    <div class="h-5">
      {#if error}
        <p class="text-sm fade-in" style="color: var(--error);">{error}</p>
      {:else if longURL && !isURLValid}
        <p class="text-sm fade-in" style="color: var(--error);">That doesn't look like a valid link</p>
      {/if}
    </div>
  {/if}

  <!-- Main URL input with inline action -->
  <div
    class="relative transition-all"
    class:shake={shakeInput}
    style="transition-duration: var(--duration-normal);"
  >
    <input
      bind:this={inputRef}
      type="text"
      id="url"
      name="url"
      bind:value={longURL}
      on:keydown={handleKeydown}
      placeholder={compact ? 'https://example.com/very/long/link' : 'Paste a link'}
      class="w-full outline-none transition-all"
      class:py-4={!compact}
      class:pl-5={!compact}
      class:pr-16={!compact}
      class:text-lg={!compact}
      class:rounded-xl={!compact}
      class:py-3={compact}
      class:pl-4={compact}
      class:pr-14={compact}
      class:text-base={compact}
      class:rounded-lg={compact}
      style="
        background: var(--surface);
        border: 1px solid {longURL && !isURLValid ? 'var(--error)' : isURLValid ? 'var(--accent)' : 'var(--border)'};
        color: var(--text-primary);
        transition-duration: var(--duration-normal);
        min-height: {compact ? 48 : 60}px;
      "
      class:glow-accent={isURLValid && !compact}
      class:glow-error={longURL && !isURLValid && !compact}
      aria-label="URL to shorten"
    />

    <!-- Right-side inline action: submit / clear / loading -->
    {#if isLoading}
      <div
        class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
        style="width: 44px; height: 44px;"
        aria-hidden="true"
      >
        <div class="spinner"></div>
      </div>
    {:else if isURLValid}
      <button
        type="submit"
        class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg flex items-center justify-center"
        style="width: 44px; height: 44px; color: var(--accent);"
        aria-label="Shorten link"
        title="Shorten (Enter)"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
    {:else if longURL}
      <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg flex items-center justify-center"
        style="width: 44px; height: 44px; color: var(--text-muted);"
        on:click={clearInput}
        aria-label="Clear input"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Custom alias: reveal-style on default, always-visible on compact -->
  {#if compact}
    <div class="flex gap-2">
      <div
        class="alias-chip flex items-center rounded-lg flex-1 min-w-0"
        class:shake={shakeAlias}
        style="
          background: var(--surface);
          border: 1px solid {customURL && !isAliasValid ? 'var(--error)' : 'var(--border)'};
          transition-duration: var(--duration-normal);
          height: 44px;
        "
      >
        <span class="pl-3 text-sm whitespace-nowrap" style="color: var(--text-muted);">iksi.app/</span>
        <input
          type="text"
          id="alias"
          name="alias"
          bind:value={customURL}
          placeholder="custom alias (optional)"
          maxlength="50"
          class="flex-1 min-w-0 px-1 text-sm bg-transparent outline-none"
          style="color: var(--text-primary); height: 100%;"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="Custom alias"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        class="px-5 text-sm font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer; height: 44px;"
      >
        {isLoading ? 'Shortening…' : 'Shorten'}
      </button>
    </div>
    {#if error}
      <p class="text-xs" style="color: var(--error);">{error}</p>
    {:else if longURL && !isURLValid}
      <p class="text-xs" style="color: var(--error);">That doesn't look like a valid link.</p>
    {:else if customURL && !isAliasValid}
      <p class="text-xs" style="color: var(--error);">Alias must be letters, numbers, <code style="font-family: inherit;">_</code> or <code style="font-family: inherit;">-</code>.</p>
    {/if}
  {:else}
    <div
      class="flex items-center justify-start"
      style="min-height: 44px;"
    >
      {#if !showCustomAlias}
        <button
          type="button"
          class="text-sm transition-colors hover:underline"
          style="color: var(--text-muted);"
          on:click={() => { showCustomAlias = true; }}
        >
          Want a custom link?
        </button>
      {:else}
        <div
          class="alias-chip flex items-center rounded-lg"
          class:shake={shakeAlias}
          class:glow-error={customURL && !isAliasValid}
          style="
            background: var(--surface);
            border: 1px solid {customURL && !isAliasValid ? 'var(--error)' : 'var(--border)'};
            transition-duration: var(--duration-normal);
            height: 44px;
            width: 100%;
            max-width: 380px;
          "
        >
          <span class="pl-3 text-sm whitespace-nowrap" style="color: var(--text-muted);">iksi.app/</span>
          <input
            type="text"
            id="alias"
            name="alias"
            bind:value={customURL}
            placeholder="your-alias"
            maxlength="50"
            class="flex-1 min-w-0 px-1 text-sm bg-transparent outline-none"
            style="color: var(--text-primary); height: 100%;"
            aria-label="Custom alias"
          />
          <button
            type="button"
            class="flex items-center justify-center flex-shrink-0"
            style="width: 36px; height: 100%; color: var(--text-muted);"
            on:click={() => { showCustomAlias = false; customURL = ''; }}
            aria-label="Cancel custom alias"
            title="Cancel"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</form>
