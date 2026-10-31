<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/state';

  let { data, form } = $props();

  let submitting = $state(false);

  const TITLES = {
    preview: 'Link preview',
    password: 'Password required',
    expired: 'Link expired',
    flagged: 'Link disabled'
  };

  let title = $derived(`${TITLES[data.view]} | iksi`);
  let error = $derived(form?.error ?? data.error ?? null);

  const VERDICTS = {
    malware: 'malware',
    phishing: 'phishing',
    unwanted: 'unwanted software'
  };
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex-1 flex items-center justify-center">
  <div class="w-full max-w-[500px] text-center">
    {#if data.view === 'preview'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
        {data.destination === null ? 'Password protected' : data.host}
      </h1>
      {#if data.destination !== null}
        <p
          class="mt-4 px-4 py-3 rounded-xl text-sm text-left break-all"
          style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
        >
          {data.destination}
        </p>
      {/if}
      <p class="mt-2 text-sm" style="color: var(--text-muted); min-height: 20px;">
        {#if data.destination === null}
          The destination is hidden until you unlock the link.
        {:else if data.hasRules}
          Where you land may depend on your location, device or the time.
        {/if}
      </p>
      <a
        href={page.url.pathname.replace(/\+$/, '')}
        class="inline-flex items-center justify-center mt-6 px-5 text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
        style="background: var(--text-primary); color: var(--bg); height: 44px;"
      >
        Continue
      </a>
    {:else if data.view === 'password'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
        This link is protected
      </h1>
      <form
        method="POST"
        action="?/unlock"
        class="mt-6 space-y-4"
        use:enhance={() => {
          submitting = true;
          return async ({ update }) => {
            await update({ reset: false });
            submitting = false;
          };
        }}
      >
        <div class="h-5">
          {#if error}
            <p class="text-sm fade-in" style="color: var(--error);">{error}</p>
          {/if}
        </div>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          placeholder="Password"
          maxlength="200"
          required
          class="w-full outline-none transition-all py-4 px-5 text-lg rounded-xl"
          style="background: var(--surface); border: 1px solid {error ? 'var(--error)' : 'var(--border)'}; color: var(--text-primary); transition-duration: var(--duration-normal); min-height: 60px;"
          aria-label="Password"
        />
        <button
          type="submit"
          disabled={submitting}
          class="w-full text-sm font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer; height: 44px;"
        >
          Continue
        </button>
      </form>
    {:else if data.view === 'expired'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
        This link has expired.
      </h1>
      <a href="/" class="inline-block mt-6 text-sm hover:opacity-70 transition-opacity" style="color: var(--accent);">
        Back to iksi
      </a>
    {:else if data.view === 'flagged'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
        Link disabled
      </h1>
      <p class="mt-2 text-sm" style="color: var(--text-muted);">
        This link was flagged by Google Safe Browsing as {VERDICTS[data.verdict] ?? data.verdict} and has been disabled.
      </p>
      <a href="/" class="inline-block mt-6 text-sm hover:opacity-70 transition-opacity" style="color: var(--accent);">
        Back to iksi
      </a>
    {/if}
  </div>
</div>
