<script>
  import { Input, ShortenedURL } from '#lib/components//index.js';
  import { onMount } from 'svelte';

  const FEATURES = [
    { title: 'Custom aliases', body: 'Pick the slug yourself: iksi.app/your-name instead of a random string.' },
    { title: 'QR codes', body: 'Every short link comes with a QR code, ready to download.' },
    { title: 'Smart routing', body: 'Send visitors to different destinations by country, device, OS or time of day.' },
    { title: 'Passwords and expiry', body: 'Lock a link behind a password, or let it expire on a date or after a set number of clicks.' },
    { title: 'Safe by default', body: 'Destinations are checked against Google Safe Browsing, and flagged links are disabled.' },
    { title: 'Your own page', body: 'Claim iksi.app/@you and turn your links into a public profile.' }
  ];

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
    if (e.key !== 'Escape') return;
    // If a modal dialog is open (e.g., QR code), let it handle Escape itself.
    if (typeof document !== 'undefined' && document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    if (shortURL) {
      reset();
    } else {
      longURL = '';
      customURL = '';
      error = '';
    }
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="w-full flex flex-col items-center">
  <!-- The tool fills the first screen exactly as before; the copy below is for
       people who scroll and for search engines, which had no text to read. -->
  <div class="w-full max-w-[500px] min-h-[100svh] flex flex-col justify-center">
    <h1 class="sr-only">iksi — free URL shortener</h1>
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

  <section aria-labelledby="about-heading" class="w-full max-w-[500px] pb-24 space-y-10">
    <div class="space-y-2">
      <h2 id="about-heading" class="text-base font-medium" style="color: var(--text-primary);">
        A free URL shortener that stays out of the way
      </h2>
      <p class="text-sm leading-relaxed" style="color: var(--text-muted);">
        Paste a long link, get a short one, no signup needed. No interstitial ads on your
        links, and redirects served from the edge. <em>Iksi</em> is Tagalog for "short".
      </p>
    </div>

    <dl class="grid gap-6 sm:grid-cols-2">
      {#each FEATURES as f}
        <div class="space-y-1">
          <dt class="text-sm font-medium" style="color: var(--text-primary);">{f.title}</dt>
          <dd class="text-sm leading-relaxed" style="color: var(--text-muted);">{f.body}</dd>
        </div>
      {/each}
    </dl>

    <p class="text-sm" style="color: var(--text-muted);">
      <a href="/login" class="underline decoration-1 underline-offset-2 hover:opacity-70 transition-opacity" style="color: var(--text-primary);">Sign in</a>
      for routing, passwords, expiry and your own page.
    </p>
  </section>
</div>
