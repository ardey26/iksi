<script>
  import { createEventDispatcher } from 'svelte';
  import { copyToClipboard } from '../utils/clipboard.js';

  export let shortURL;

  const dispatch = createEventDispatcher();

  let copied = false;

  $: fullURL = typeof window !== 'undefined'
    ? `${location.protocol}//${location.host}/${shortURL}`
    : shortURL;

  $: displayURL = typeof window !== 'undefined'
    ? `${location.hostname.replace('www.', '')}/${shortURL}`
    : shortURL;

  const copy = async () => {
    const success = await copyToClipboard(fullURL);
    if (success) {
      copied = true;
      setTimeout(() => { copied = false; }, 1500);
    }
  };

  const reset = () => {
    dispatch('reset');
  };
</script>

<div class="space-y-4 fade-in">
  <!-- Reserved error space (matching Input) -->
  <div class="h-5"></div>

  <!-- Result display (same dimensions as input) -->
  <div
    class="w-full py-4 px-5 rounded-xl cursor-pointer transition-all glow-accent"
    style="background: var(--surface); border: 1px solid var(--accent);"
    on:click={copy}
    on:keydown={(e) => e.key === 'Enter' && copy()}
    role="button"
    tabindex="0"
    aria-label="Click to copy shortened URL"
  >
    <p
      class="text-lg font-medium truncate"
      style="color: var(--accent);"
    >
      {displayURL}
    </p>
  </div>

  <!-- Copy button (same position as submit) -->
  <button
    type="button"
    on:click={copy}
    class="w-full py-4 px-5 text-base font-medium rounded-xl transition-all flex items-center justify-center"
    style="background: var(--accent); color: var(--bg); min-height: 56px;"
  >
    {copied ? 'Copied' : 'Copy'}
  </button>

  <!-- Reset link (same position as custom alias toggle) -->
  <div class="text-center">
    <button
      type="button"
      class="text-sm transition-colors hover:underline"
      style="color: var(--text-muted);"
      on:click={reset}
    >
      Shorten another
    </button>
  </div>

  <!-- Reserved space for alias input area -->
  <div class="h-0"></div>
</div>
