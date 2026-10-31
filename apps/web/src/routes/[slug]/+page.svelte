<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import LinkNotice from '#lib/components/LinkNotice.svelte';
  import { PASSWORD_MAX } from '#lib/password-limits.js';

  let { data, form } = $props();

  let submitting = $state(false);

  let title = $derived(
    `${data.view === 'password' ? 'Password required' : data.flagged ? 'Link disabled' : data.expired ? 'Link expired' : 'Link preview'} | iksi`
  );
  let error = $derived(form?.error ?? data.error ?? null);

</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex-1 flex items-center justify-center">
  <div class="w-full max-w-[500px] text-center">
    {#if data.view === 'preview' && (data.flagged || data.expired)}
      <LinkNotice view={data.flagged ? 'flagged' : 'expired'} verdict={data.flagged} host={data.host} />
    {:else if data.view === 'preview'}
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
