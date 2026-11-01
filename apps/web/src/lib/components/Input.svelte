<script>
  // The home shortener form: paste a link, optionally pick a name, shorten.
  // Nothing above a change moves: the custom name opens below the button row,
  // the button that opens it stays where it is, and messages use one
  // reserved line. See DESIGN.md (No layout shifts).
  import { slide } from 'svelte/transition';
  import { Button, IconButton, Input as Field } from '#lib/ui/index.js';
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

  <!-- One reserved line for every message, so nothing below it moves. -->
  <div class="status" id="shorten-status" aria-live="polite">
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

  <!-- The toggle stays put and the name opens under this row. DOM order is
       toggle, name, submit, so Tab reaches the name before Shorten. -->
  <div class="actions">
    <Button
      variant="ghost"
      size="sm"
      icon="plus"
      class="flush disclose"
      aria-expanded={showCustomAlias}
      aria-controls="alias-panel"
      on:click={toggleAlias}
    >
      Custom name
    </Button>
    <div class="panel" id="alias-panel">
      {#if showCustomAlias}
        <!-- Kit field box with a fixed prefix, so the name reads as the final URL. -->
        <div class="alias" class:shake={shakeAlias} transition:slide={motion({ duration: DISCLOSE_MS, easing: easeOut })}>
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
          </div>
        </div>
      {/if}
    </div>
    <div class="submit">
      <Button type="submit" variant="primary" disabled={!longURL} loading={isLoading} aria-label="Shorten link">
        Shorten
      </Button>
    </div>
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
  /* Exactly one line, whatever it says, so the buttons never move. */
  .status {
    height: 20px;
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
  /* Row one: toggle left, submit right. Row two: the custom name, which
     slides open downward, so nothing in row one moves. */
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
  /* The gap lives inside the sliding element, so it opens with it. */
  .alias { padding-top: 12px; }
  /* A ghost button's text lines up with the field edge above it. */
  .actions :global(.flush) { margin-left: -10px; }
  /* Open, the plus turns into a close mark. */
  .actions :global(.disclose .ui-icon) { transition: transform var(--duration-normal) var(--ease-out); }
  .actions :global(.disclose[aria-expanded='true'] .ui-icon) { transform: rotate(45deg); }
  @media (prefers-reduced-motion: reduce) {
    .actions :global(.disclose .ui-icon) { transition: none; }
  }
</style>
