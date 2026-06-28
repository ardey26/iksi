<script>
  import { isValidURL, isValidAlias } from '../utils/urlValidation.js';

  export let longURL = '';
  export let customURL = '';
  export let showCustomAlias = false;
  export let isLoading = false;
  export let error = '';
  export let handleSubmit;
  export let inputRef = null;

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

<form on:submit|preventDefault={submit} class="space-y-4">
  <!-- Error message space (reserved, no layout shift) -->
  <div class="h-5">
    {#if error}
      <p class="text-sm fade-in" style="color: var(--error);">{error}</p>
    {:else if longURL && !isURLValid}
      <p class="text-sm fade-in" style="color: var(--error);">That doesn't look like a valid link</p>
    {/if}
  </div>

  <!-- Main URL input -->
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
      placeholder="Paste a link"
      class="w-full py-4 px-5 pr-12 text-lg rounded-xl outline-none transition-all"
      style="
        background: var(--surface);
        border: 1px solid {longURL && !isURLValid ? 'var(--error)' : isURLValid ? 'var(--accent)' : 'var(--border)'};
        color: var(--text-primary);
        transition-duration: var(--duration-normal);
      "
      class:glow-accent={isURLValid}
      class:glow-error={longURL && !isURLValid}
      aria-label="URL to shorten"
    />

    {#if longURL}
      <!-- Clear button (only when there's content to clear) -->
      <button
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg"
        style="color: var(--text-muted);"
        on:click={clearInput}
        aria-label="Clear input"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Submit button (always visible, disabled until URL is valid) -->
  <button
    type="submit"
    disabled={!canSubmit}
    class="w-full py-4 px-5 text-base font-medium rounded-xl transition-all flex items-center justify-center"
    style="
      background: var(--accent);
      color: var(--bg);
      transition-duration: var(--duration-normal);
      min-height: 56px;
      opacity: {canSubmit ? 1 : 0.5};
      cursor: {canSubmit ? 'pointer' : 'not-allowed'};
    "
  >
    {#if isLoading}
      <div class="spinner"></div>
    {:else}
      Shorten
    {/if}
  </button>

  <!-- Custom alias toggle -->
  <div class="text-center">
    <button
      type="button"
      class="text-sm transition-colors hover:underline"
      style="color: var(--text-muted);"
      on:click={() => { showCustomAlias = !showCustomAlias; }}
    >
      {showCustomAlias ? 'Never mind' : 'Want a custom link?'}
    </button>
  </div>

  <!-- Custom alias input (space reserved) -->
  <div
    class="transition-all overflow-hidden"
    style="
      height: {showCustomAlias ? '60px' : '0'};
      opacity: {showCustomAlias ? 1 : 0};
      transition-duration: var(--duration-slow);
    "
  >
    <div
      class="relative flex items-center"
      class:shake={shakeAlias}
    >
      <span
        class="absolute left-4 text-base"
        style="color: var(--text-muted);"
      >
        iksi.app/
      </span>
      <input
        type="text"
        id="alias"
        name="alias"
        bind:value={customURL}
        placeholder="your-alias"
        maxlength="50"
        class="w-full py-4 pl-[5.5rem] pr-4 text-base rounded-xl outline-none transition-all"
        style="
          background: var(--surface);
          border: 1px solid {customURL && !isAliasValid ? 'var(--error)' : 'var(--border)'};
          color: var(--text-primary);
          transition-duration: var(--duration-normal);
        "
        class:glow-error={customURL && !isAliasValid}
        aria-label="Custom alias"
      />
    </div>
  </div>
</form>
