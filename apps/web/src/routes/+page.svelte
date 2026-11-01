<script>
  import { Input, ShortenedURL } from '#lib/components/index.js';
  import OneTimeForm from '#lib/components/OneTimeForm.svelte';
  import { Button, Container, Paper, Segmented } from '#lib/ui/index.js';
  import { onMount, tick } from 'svelte';

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
  // A free iksi.app/@handle/name the server offered for a taken custom name.
  let suggestion = '';
  // Editing either field means the offer no longer answers what is typed.
  $: longURL, customURL, (suggestion = '');
  let inputRef;
  // 'link' is the regular shortener; 'oneTime' creates a burn-after-reading link.
  let mode = 'link';
  let oneTimeRef;
  let createdOneTime = false;

  const focusLater = async (get) => {
    await tick();
    get()?.focus();
  };

  const MODES = [
    { value: 'link', label: 'Short link' },
    { value: 'oneTime', label: 'One-time link' }
  ];

  // The mode switch moves focus into the form it shows.
  const switchMode = (e) => {
    error = '';
    if (e.detail.value === 'oneTime') focusLater(() => oneTimeRef);
    else focusLater(() => inputRef);
  };

  const oneTimeCreated = (e) => {
    createdOneTime = true;
    shortURL = e.detail.shortURL;
  };

  onMount(() => {
    // Auto-focus input on mount
    if (inputRef) {
      inputRef.focus();
    }
  });

  const handleSubmit = async (name = customURL.trim()) => {
    if (isLoading) return;

    isLoading = true;
    error = '';
    suggestion = '';

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        body: JSON.stringify({ longURL: longURL.trim(), customURL: name }),
        headers: { 'content-type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        shortURL = data.shortURL;
        // Don't reset isLoading on success - component unmounts anyway
      } else if (typeof data.suggestion === 'string') {
        // Stays until it is used or the name changes.
        suggestion = data.suggestion;
        isLoading = false;
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
    suggestion = '';
    isLoading = false;
    mode = 'link';
    createdOneTime = false;
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

<div class="home">
  <section class="hero" aria-labelledby="home-title">
    <Container width="form" class="hero-inner">
      <h1 id="home-title" class="t-display headline">Make long links short.</h1>
      <p class="lede">
        iksi is a free URL shortener. Paste a link, get a short one. No signup.
      </p>

      <Paper class="tool">
        {#if shortURL}
          <ShortenedURL {shortURL} note={createdOneTime ? 'One-time link. It opens once.' : ''} on:reset={reset} />
        {:else}
          <div class="mode">
            <Segmented size="sm" label="Link type" bind:value={mode} options={MODES} on:change={switchMode} />
          </div>
          {#if mode === 'oneTime'}
            <OneTimeForm bind:inputRef={oneTimeRef} on:created={oneTimeCreated} />
          {:else}
            <Input
              bind:longURL
              bind:customURL
              bind:showCustomAlias
              bind:inputRef
              {isLoading}
              {error}
              {handleSubmit}
              {suggestion}
              onSuggestion={() => handleSubmit(suggestion)}
            />
          {/if}
        {/if}
      </Paper>
    </Container>
  </section>

  <!-- For people who scroll and for search engines. Hairline grid, after Composer. -->
  <section class="band" aria-labelledby="about-heading">
    <Container width="wide">
      <div class="about">
        <h2 id="about-heading" class="about-title">A free URL shortener that stays out of the way</h2>
        <p class="about-body">
          Paste a long link, get a short one, no signup needed. No interstitial ads on your links, and
          redirects served from the edge. <em>Iksi</em> is Tagalog for "short".
        </p>
      </div>
    </Container>
  </section>

  <section class="band grid-band" aria-label="Features">
    <Container width="wide">
      <dl class="features">
        {#each FEATURES as f}
          <div class="feature">
            <dt class="feature-title">{f.title}</dt>
            <dd class="feature-body">{f.body}</dd>
          </div>
        {/each}
      </dl>
    </Container>
  </section>

  <section class="band cta" aria-label="Sign in">
    <Container width="wide">
      <div class="cta-inner">
        <p class="cta-text">Sign in for routing, passwords, expiry and your own page.</p>
        <Button href="/login">Sign in</Button>
      </div>
    </Container>
  </section>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .hero { padding: 40px 0 64px; }
  @media (min-width: 768px) {
    .hero { padding: 72px 0 96px; }
  }
  :global(.hero-inner) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .headline {
    margin: 0;
    color: var(--text-primary);
  }
  @media (min-width: 768px) {
    /* The one place a bigger display size earns its keep. */
    .headline { font-size: 56px; line-height: 60px; }
  }
  .lede {
    max-width: 520px;
    margin: 16px 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
    text-wrap: balance;
  }
  :global(.tool) {
    width: 100%;
    max-width: 560px;
    margin-top: 32px;
    text-align: left;
  }
  .mode { margin-bottom: 16px; }

  /* Bands: full-bleed hairlines between major sections. */
  .band { border-top: 1px solid var(--border); }
  .band:last-child { border-bottom: 0; }
  .about {
    display: grid;
    gap: 12px;
    padding: 48px 0;
  }
  @media (min-width: 768px) {
    .about {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 48px;
      padding: 64px 0;
    }
  }
  .about-title {
    margin: 0;
    font-size: 28px;
    line-height: 32px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-primary);
    text-wrap: balance;
  }
  .about-body {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
  .about-body em { color: var(--text-primary); }

  /* Feature grid: cells drawn by hairlines that meet the band's edges. */
  .features {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    margin: 0;
  }
  .feature {
    padding: 24px 0;
  }
  .feature + .feature { border-top: 1px solid var(--border); }
  @media (min-width: 640px) {
    .features {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-left: 1px solid var(--border);
    }
    .feature {
      padding: 32px 24px;
      border-right: 1px solid var(--border);
    }
    .feature + .feature { border-top: 0; }
    .feature:nth-child(n + 3) { border-top: 1px solid var(--border); }
  }
  @media (min-width: 960px) {
    .features { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .feature:nth-child(n + 3) { border-top: 0; }
    .feature:nth-child(n + 4) { border-top: 1px solid var(--border); }
  }
  .feature-title {
    font-size: 15px;
    line-height: 22px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .feature-body {
    margin: 4px 0 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }

  .cta-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 32px 0 48px;
  }
  .cta-text {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
</style>
