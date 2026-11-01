<script>
  // A short link's page: password, preview, one-time reveal.
  import { applyAction, enhance } from '$app/forms';
  import { page } from '$app/state';
  import LinkNotice from '#lib/components/LinkNotice.svelte';
  import { PASSWORD_MAX } from '#lib/password-limits.js';
  import { copyToClipboard } from '#lib/utils/clipboard.js';

  let { data, form } = $props();

  let submitting = $state(false);
  let copied = $state(false);

  // A one-time result lives only in this page's form state: the server has
  // already erased it, so it is gone once the visitor leaves.
  let revealed = $derived(typeof form?.text === 'string' ? form.text : null);
  let opened = $derived(
    !revealed && (form?.opened === true || data.view === 'opened' || (data.view === 'preview' && data.opened))
  );

  let title = $derived(
    `${
      revealed !== null
        ? 'One-time message'
        : opened
          ? 'Link opened'
          : data.view === 'reveal'
            ? 'One-time link'
            : data.view === 'password'
              ? 'Password required'
              : data.flagged
                ? 'Link disabled'
                : data.expired
                  ? 'Link expired'
                  : 'Link preview'
    } | iksi`
  );
  let error = $derived(form?.error ?? data.error ?? null);

  async function copyText() {
    if (revealed === null) return;
    if (await copyToClipboard(revealed)) {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    }
  }

  // The revealed text arrives as the action result. Re-running load would
  // replace it with the "already opened" page, so success is applied as is.
  const revealEnhance = () => {
    submitting = true;
    return async ({ result, update }) => {
      if (result.type === 'success') await applyAction(result);
      else await update({ reset: false, invalidateAll: false });
      submitting = false;
    };
  };
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex-1 flex items-center justify-center">
  <div class="w-full max-w-[500px] text-center">
    {#if revealed !== null}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">One-time message</h1>
      <!-- A long message scrolls, so keyboard users must be able to focus it. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="secret mt-6 px-5 py-4 rounded-xl text-left"
        role="region"
        aria-label="Message"
        tabindex="0"
      >{revealed}</div>
      <p class="mt-2 text-sm" style="color: var(--text-muted); min-height: 20px;">
        This message is no longer stored on iksi. Copy it now if you need it.
      </p>
      <button
        type="button"
        onclick={copyText}
        class="mt-6 px-5 text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
        style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer; height: 44px; min-width: 120px;"
      >
        <span aria-live="polite">{copied ? 'Copied' : 'Copy text'}</span>
      </button>
    {:else if opened}
      <LinkNotice view="opened" />
    {:else if data.view === 'preview' && (data.flagged || data.expired)}
      <LinkNotice view={data.flagged ? 'flagged' : 'expired'} verdict={data.flagged} host={data.host} />
    {:else if data.view === 'preview'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
        {data.oneTime ? 'One-time link' : data.destination === null ? 'Password protected' : data.host}
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
        {#if data.oneTime}
          The content stays hidden until someone opens it, and it can be opened once.
        {:else if data.destination === null}
          The destination is hidden until you unlock the link.
        {:else if data.hasRules}
          This link may send some visitors elsewhere
        {/if}
      </p>
      <a
        href={page.url.pathname.replace(/\+$/, '')}
        data-sveltekit-reload
        class="inline-flex items-center justify-center mt-6 px-5 text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
        style="background: var(--text-primary); color: var(--bg); height: 44px;"
      >
        Continue
      </a>
    {:else if data.view === 'reveal'}
      <h1 class="text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">Tap to reveal</h1>
      <p class="mt-2 text-sm" style="color: var(--text-muted);">
        {data.kind === 'url' ? 'This one-time link opens a website.' : 'This one-time link holds a message.'}
        It can be opened once, then it is gone.
      </p>
      <form method="POST" action="?/reveal" class="mt-6 space-y-4" use:enhance={revealEnhance}>
        <div class="h-5">
          {#if error}
            <p class="text-sm fade-in" style="color: var(--error);">{error}</p>
          {/if}
        </div>
        {#if data.password}
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Password"
            maxlength={PASSWORD_MAX}
            required
            class="w-full outline-none transition-all py-4 px-5 text-lg rounded-xl"
            style="background: var(--surface); border: 1px solid {error ? 'var(--error)' : 'var(--border)'}; color: var(--text-primary); transition-duration: var(--duration-normal); min-height: 60px;"
            aria-label="Password"
          />
        {/if}
        <button
          type="submit"
          disabled={submitting}
          class="w-full text-sm font-medium rounded-lg transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          style="background: var(--text-primary); color: var(--bg); border: none; cursor: pointer; height: 44px;"
        >
          {data.kind === 'url' ? 'Open link' : 'Reveal message'}
        </button>
      </form>
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
          maxlength={PASSWORD_MAX}
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
    {/if}
  </div>
</div>

<style>
  .secret {
    max-height: 50vh;
    overflow-y: auto;
    font-size: 16px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text-primary);
    background-color: var(--surface);
    border: 1px solid var(--border);
  }
  .secret:focus-visible {
    outline: 1px solid var(--border-focus);
    outline-offset: 2px;
  }
</style>
