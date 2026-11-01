<script>
  // A short link's page (password, preview, one-time reveal) at /[slug] and /@[handle]/[name].
  import { applyAction, enhance } from '$app/forms';
  import { page } from '$app/state';
  import { Button, IconButton, Input } from '#lib/ui/index.js';
  import Interstitial from '#lib/components/Interstitial.svelte';
  import LinkNotice from '#lib/components/LinkNotice.svelte';
  import { PASSWORD_MAX } from '#lib/password-limits.js';
  import { copyToClipboard } from '#lib/utils/clipboard.js';
  import { reportHref } from '#lib/report.js';

  let { data, form } = $props();

  let submitting = $state(false);
  let copied = $state(false);
  let showPassword = $state(false);

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
                ? data.flagged === 'review'
                  ? 'Link under review'
                  : 'Link disabled'
                : data.expired
                  ? 'Link expired'
                  : 'Link preview'
    } | iksi`
  );
  let error = $derived(form?.error ?? data.error ?? null);

  // Preview copy: what the visitor is about to open.
  let preview = $derived(
    data.view !== 'preview'
      ? null
      : data.oneTime
        ? {
            icon: 'eye',
            title: 'One-time link',
            body: 'The content stays hidden until someone opens it, and it can be opened once.'
          }
        : data.destination === null
          ? { icon: 'lock', title: 'Password protected', body: 'The destination is hidden until you unlock the link.' }
          : {
              icon: 'link',
              title: data.host,
              body: data.hasRules ? 'This link may send some visitors elsewhere' : 'This short link opens the address below.'
            }
  );

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

  const unlockEnhance = () => {
    submitting = true;
    return async ({ update }) => {
      await update({ reset: false });
      submitting = false;
    };
  };
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#snippet passwordField()}
  <Input
    label="Password"
    type={showPassword ? 'text' : 'password'}
    name="password"
    autocomplete="current-password"
    maxlength={PASSWORD_MAX}
    required
    error={error ?? ''}
  >
    <IconButton
      slot="end"
      icon={showPassword ? 'eye-off' : 'eye'}
      label={showPassword ? 'Hide password' : 'Show password'}
      on:click={() => (showPassword = !showPassword)}
    />
  </Input>
{/snippet}

{#snippet shared()}
  <span>Shared with iksi</span>
  <a href={reportHref(page.url, import.meta.env.DEV)}>Report this link</a>
{/snippet}

{#if revealed !== null}
  <Interstitial
    icon="check"
    title="One-time message"
    description="This message is no longer stored on iksi. Copy it now if you need it."
  >
    <div class="stack">
      <!-- A long message scrolls, so keyboard users must be able to focus it. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="secret" role="region" aria-label="Message" tabindex="0">{revealed}</div>
      <Button variant="primary" size="lg" full icon={copied ? 'check' : 'copy'} on:click={copyText}>
        <span aria-live="polite">{copied ? 'Copied' : 'Copy text'}</span>
      </Button>
    </div>
    <svelte:fragment slot="below">{@render shared()}</svelte:fragment>
  </Interstitial>
{:else if opened}
  <LinkNotice view="opened" />
{:else if data.view === 'preview' && (data.flagged || data.expired)}
  <LinkNotice view={data.flagged ? 'flagged' : 'expired'} verdict={data.flagged} host={data.host} />
{:else if preview}
  <Interstitial icon={preview.icon} title={preview.title} description={preview.body}>
    <div class="stack">
      {#if data.destination !== null}
        <p class="destination t-mono">{data.destination}</p>
      {/if}
      <Button variant="primary" size="lg" full href={page.url.pathname.replace(/\+$/, '')} data-sveltekit-reload>
        Continue
      </Button>
    </div>
    <svelte:fragment slot="below">{@render shared()}</svelte:fragment>
  </Interstitial>
{:else if data.view === 'reveal'}
  <Interstitial
    icon="eye"
    title="Someone sent you a one-time link"
    description="{data.kind === 'url'
      ? 'It opens a website.'
      : 'It holds a message.'} It can be opened once, then it is gone."
  >
    <form method="POST" action="?/reveal" class="stack" use:enhance={revealEnhance}>
      {#if data.password}
        {@render passwordField()}
      {:else}
        <p class="status" aria-live="polite">{error ?? ''}</p>
      {/if}
      <Button type="submit" variant="primary" size="lg" full loading={submitting}>
        {data.kind === 'url' ? 'Open link' : 'Reveal message'}
      </Button>
    </form>
    <svelte:fragment slot="below">{@render shared()}</svelte:fragment>
  </Interstitial>
{:else if data.view === 'password'}
  <Interstitial icon="lock" title="This link is protected" description="Enter the password to continue.">
    <form method="POST" action="?/unlock" class="stack" use:enhance={unlockEnhance}>
      {@render passwordField()}
      <Button type="submit" variant="primary" size="lg" full loading={submitting}>Continue</Button>
    </form>
    <svelte:fragment slot="below">{@render shared()}</svelte:fragment>
  </Interstitial>
{/if}

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: left;
  }
  /* The password field's message line already gives the gap above the button. */
  .stack > :global(.field) { margin-bottom: -8px; }
  .secret {
    max-height: 50vh;
    padding: 12px 16px;
    overflow-y: auto;
    font-size: 15px;
    line-height: 22px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text-primary);
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
  .secret:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .destination {
    margin: -8px 0 0;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 20px;
    color: var(--text-primary);
    overflow-wrap: anywhere;
    background-color: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }
  /* Reserved, so an error never moves the button. */
  .status {
    min-height: 16px;
    margin: -8px 0 0;
    font-size: 12px;
    line-height: 16px;
    color: var(--error);
    text-align: center;
  }
</style>
