<script>
  import { Input, ShortenedURL } from '$lib/components/';
  import { onMount } from 'svelte';
  
  let longURL = '';
  let customURL = '';
  let shortURL = '';
  let isLoading = false;
  let error = '';
  let showCustomAlias = false;
  let inputRef;

  onMount(() => {
    // Auto-focus input on mount
    if (inputRef) {
      inputRef.focus();
    }
  });

  const handleSubmit = async () => {
    if (isLoading) return;

    isLoading = true;
    error = '';

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
        headers: { 'content-type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        shortURL = data.shortURL;
        // Don't reset isLoading on success - component unmounts anyway
      } else {
        error = data.error || 'Something went wrong';
        setTimeout(() => { error = ''; }, 4000);
        isLoading = false;
      }
    } catch (err) {
      error = 'Network error. Please try again.';
      setTimeout(() => { error = ''; }, 4000);
      isLoading = false;
    }
  };

  const reset = () => {
    shortURL = '';
    longURL = '';
    customURL = '';
    showCustomAlias = false;
    error = '';
    isLoading = false;
    // Refocus input after reset
    setTimeout(() => {
      if (inputRef) inputRef.focus();
    }, 50);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      if (shortURL) {
        reset();
      } else {
        longURL = '';
        customURL = '';
        error = '';
      }
    }
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full max-w-[500px] px-4">
  {#if shortURL}
    <ShortenedURL {shortURL} on:reset={reset} />
  {:else}
    <Input
      bind:longURL
      bind:customURL
      bind:showCustomAlias
      bind:inputRef
      {isLoading}
      {error}
      {handleSubmit}
    />
  {/if}
</div>
