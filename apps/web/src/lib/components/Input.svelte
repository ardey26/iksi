<script>
  // The home shortener form: paste a link, optionally pick a name, shorten.
  // Nothing above a change moves: the custom name opens below its toggle,
  // the toggle stays where it is, and messages use the one line at the end.
  // See DESIGN.md (Home hero, No layout shifts).
  import { slide } from 'svelte/transition';
  import { Button, IconButton } from '#lib/ui/index.js';
  import { DISCLOSE_MS, easeOut, motion } from '#lib/ui/motion.js';
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
    // No scroll: the field is still sliding open inside a clipped box.
    setTimeout(() => aliasRef?.focus({ preventScroll: true }), 0);
  };

  // Closing drops the name, so a hidden name is never sent.
  const closeAlias = () => {
    showCustomAlias = false;
    customURL = '';
  };

  const toggleAlias = () => (showCustomAlias ? closeAlias() : openAlias());

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

<!-- The bar holds the field and Shorten. Under it, the toggle row stays put
     and the custom name opens below it; the one message line comes last. -->
<form class="shorten" on:submit|preventDefault={submit} novalidate>
  <div class="pill-bar" class:shake={shakeInput} data-invalid={urlInvalid || undefined}>
    <label class="sr-only" for="url">URL to shorten</label>
    <input
      bind:value={longURL}
      bind:this={inputRef}
      data-ui
      class="pill-native"
      type="text"
      id="url"
      name="url"
      placeholder="Paste a long link"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-invalid={urlInvalid || undefined}
      aria-describedby="shorten-status"
    />
    {#if longURL && !isLoading}
      <IconButton icon="x" label="Clear input" on:click={clearInput} />
    {/if}
    <Button type="submit" variant="primary" size="lg" disabled={!longURL} loading={isLoading} aria-label="Shorten link">
      Shorten
    </Button>
  </div>

  <div class="pill-toggle">
    <Button
      variant="ghost"
      size="sm"
      icon="plus"
      class="disclose"
      aria-expanded={showCustomAlias}
      aria-controls="alias-panel"
      on:click={toggleAlias}
    >
      Want a custom one?
    </Button>
  </div>
  <div id="alias-panel">
    {#if showCustomAlias}
      <!-- A fixed prefix, so the name reads as the final URL. -->
      <div class="alias" class:shake={shakeAlias} transition:slide={motion({ duration: DISCLOSE_MS, easing: easeOut })}>
        <label class="sr-only" for="alias">Custom name</label>
        <div class="pill-bar sub" data-invalid={aliasInvalid || undefined}>
          <span class="prefix t-mono" aria-hidden="true">iksi.app/</span>
          <input
            bind:value={customURL}
            bind:this={aliasRef}
            data-ui
            class="pill-native t-mono"
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
        </div>
      </div>
    {/if}
  </div>

  <!-- One line for every message, after everything it could describe. -->
  <div class="pill-status" id="shorten-status" aria-live="polite">
    {#if suggestion && onSuggestion}
      <!-- The lead gives way first, so the offer is always whole on one line. -->
      <p class="error offer">
        <span class="lead">That name is taken.</span>
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
</form>

<style>
  .shorten {
    display: flex;
    flex-direction: column;
  }
  .prefix {
    flex: none;
    font-size: 16px;
    color: var(--text-faint);
  }
  /* The gap lives inside the sliding element, so it opens with it. */
  .alias { padding-bottom: 12px; }
  /* The name reads as the end of the URL: mono like its prefix. */
  .alias .pill-native { font-family: var(--font-mono); }
  .error {
    margin: 0;
    overflow: hidden;
    color: var(--error);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .offer {
    display: flex;
    gap: 4px;
  }
  .lead {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .suggest {
    flex: none;
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
</style>
