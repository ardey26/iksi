<script>
  // The home shortener form: paste a link, optionally pick a name, shorten.
  import { Button, IconButton, Input as Field } from '#lib/ui/index.js';
  import { isValidURL, isValidAlias } from '../utils/urlValidation.js';

  export let longURL = '';
  export let customURL = '';
  export let showCustomAlias = false;
  export let isLoading = false;
  export let error = '';
  export let handleSubmit;
  export let inputRef = null;

  /**
   * A free `@handle/name` the server offered for a taken name, and what
   * tapping it does (creates that link). Shown in place of the error.
   */
  export let suggestion = '';
  export let onSuggestion = null;

  let aliasRef = null;
  let shakeInput = false;
  let shakeAlias = false;

  $: isURLValid = longURL ? isValidURL(longURL) : false;
  $: isAliasValid = customURL ? isValidAlias(customURL) : true;
  $: canSubmit = longURL && isURLValid && isAliasValid && !isLoading;
  $: urlInvalid = !!longURL && !isURLValid;
  $: aliasInvalid = showCustomAlias && !!customURL && !isAliasValid;

  const clearInput = () => {
    longURL = '';
    inputRef?.focus();
  };

  const openAlias = async () => {
    showCustomAlias = true;
    await Promise.resolve();
    setTimeout(() => aliasRef?.focus(), 0);
  };

  const closeAlias = () => {
    showCustomAlias = false;
    customURL = '';
    inputRef?.focus();
  };

  const shake = (target) => {
    if (target === 'input') {
      shakeInput = true;
      setTimeout(() => (shakeInput = false), 200);
    } else {
      shakeAlias = true;
      setTimeout(() => (shakeAlias = false), 200);
    }
  };

  const submit = () => {
    if (!longURL || isLoading) return;
    if (!isURLValid) return shake('input');
    if (showCustomAlias && !isAliasValid) return shake('alias');
    handleSubmit();
  };
</script>

<form class="shorten" on:submit|preventDefault={submit} novalidate>
  <div class:shake={shakeInput} class:invalid={urlInvalid}>
    <Field
      bind:value={longURL}
      bind:element={inputRef}
      id="url"
      name="url"
      label="URL to shorten"
      hideLabel
      reserve={false}
      icon="link"
      placeholder="Paste a link"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-invalid={urlInvalid || undefined}
      aria-describedby="shorten-status"
    >
      <svelte:fragment slot="end">
        {#if longURL && !isLoading}
          <IconButton icon="x" label="Clear input" on:click={clearInput} />
        {/if}
      </svelte:fragment>
    </Field>
  </div>

  {#if showCustomAlias}
    <!-- Kit field box with a fixed prefix, so the name reads as the final URL. -->
    <div class="alias" class:shake={shakeAlias}>
      <label class="sr-only" for="alias">Custom name</label>
      <div class="ui-box" data-invalid={aliasInvalid || undefined}>
        <span class="ui-affix t-mono prefix" aria-hidden="true">iksi.app/</span>
        <input
          bind:value={customURL}
          bind:this={aliasRef}
          data-ui
          class="ui-native"
          type="text"
          id="alias"
          name="alias"
          placeholder="your-name"
          maxlength="50"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-invalid={aliasInvalid || undefined}
          aria-describedby="shorten-status"
        />
        <IconButton icon="x" label="Remove custom name" on:click={closeAlias} />
      </div>
    </div>
  {/if}

  <!-- One reserved line for every message, so nothing below it moves. -->
  <div class="status" id="shorten-status" aria-live="polite">
    {#if suggestion && onSuggestion}
      <p class="error">
        That name is taken.
        <button data-ui type="button" class="suggest" on:click={onSuggestion}>Use iksi.app/{suggestion}?</button>
      </p>
    {:else if error}
      <!-- Server messages arrive lower case; shown in sentence case. -->
      <p class="error">{error.charAt(0).toUpperCase() + error.slice(1)}</p>
    {:else if urlInvalid}
      <p class="error">That doesn't look like a valid link</p>
    {:else if aliasInvalid}
      <p class="error">Use letters, numbers, _ or - in the name</p>
    {/if}
  </div>

  <div class="actions">
    {#if showCustomAlias}
      <span></span>
    {:else}
      <Button variant="ghost" size="sm" icon="plus" class="flush" on:click={openAlias}>Custom name</Button>
    {/if}
    <Button type="submit" variant="primary" disabled={!longURL} loading={isLoading} aria-label="Shorten link">
      Shorten
    </Button>
  </div>
</form>

<style>
  .shorten {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .invalid :global(.ui-box) { border-color: var(--error); }
  .invalid :global(.ui-box:focus-within) { box-shadow: 0 0 0 1px var(--error); }
  .prefix {
    margin-right: -8px;
    font-size: 14px;
  }
  .status {
    min-height: 20px;
    margin: -4px 0 -4px;
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
  .suggest {
    padding: 0;
    font: inherit;
    font-weight: 500;
    color: var(--accent);
    background: none;
    border: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }
  .suggest:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  /* A ghost button's text lines up with the field edge above it. */
  .actions :global(.flush) { margin-left: -10px; }
</style>
