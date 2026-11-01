<script lang="ts">
  // Header account control: an avatar that opens a small menu on paper.
  // A disclosure, not an ARIA menu: Tab moves through the items, Escape
  // closes and returns focus to the avatar, a click outside closes.
  import { onMount, tick } from 'svelte';

  export let user: {
    twitterHandle: string | null;
    googleEmail?: string | null;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };

  const id = 'user-menu';
  let menuOpen = false;
  let menuRoot: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let avatarBroken = false;

  function toggle() {
    menuOpen = !menuOpen;
  }
  function close() {
    menuOpen = false;
  }

  onMount(() => {
    function onClick(e: MouseEvent) {
      if (menuRoot && !menuRoot.contains(e.target as Node)) close();
    }
    async function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !menuOpen) return;
      close();
      await tick();
      trigger?.focus();
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });

  $: identityLabel = user.twitterHandle ? `@${user.twitterHandle}` : (user.googleEmail ?? '');
  $: name = user.displayName?.trim() || (user.handle ? `@${user.handle}` : identityLabel);
  $: initial = (user.displayName || user.handle || user.twitterHandle || user.googleEmail || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
</script>

<div bind:this={menuRoot} class="user-menu">
  <button
    bind:this={trigger}
    data-ui
    type="button"
    class="avatar"
    on:click|stopPropagation={toggle}
    aria-haspopup="true"
    aria-expanded={menuOpen}
    aria-controls={id}
    aria-label="Account menu"
  >
    {#if user.avatarUrl && !avatarBroken}
      <img src={user.avatarUrl} alt="" width="32" height="32" on:error={() => (avatarBroken = true)} />
    {:else}
      <span aria-hidden="true">{initial}</span>
    {/if}
  </button>

  {#if menuOpen}
    <div {id} class="menu">
      <div class="who">
        {#if user.handle}
          <a data-ui class="who-link" href={`/@${user.handle}`} on:click={close}>
            <span class="who-name">{name}</span>
            <span class="who-sub t-mono">iksi.app/@{user.handle}</span>
          </a>
        {:else if identityLabel}
          <p class="who-static"><span class="who-name">{identityLabel}</span></p>
        {/if}
      </div>
      <a data-ui class="item" href="/dashboard" on:click={close}>Dashboard</a>
      <form method="POST" action="/logout">
        <button data-ui type="submit" class="item">Sign out</button>
      </form>
    </div>
  {/if}
</div>

<style>
  .user-menu { position: relative; }

  .avatar {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    overflow: hidden;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    background-color: var(--surface-2);
    border: 0;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--border);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: box-shadow var(--duration-normal) var(--ease-out);
  }
  .avatar:hover { box-shadow: inset 0 0 0 1px var(--border-strong); }
  .avatar:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 60;
    width: 240px;
    padding: 4px;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-paper);
    box-shadow: var(--overlay-shadow);
  }
  .who {
    margin: 0 0 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
  }
  .who:empty { display: none; }
  .who-link,
  .who-static {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 8px 10px;
    text-decoration: none;
    border-radius: 10px;
  }
  .who-link:hover { background-color: var(--surface-2); }
  .who-link:focus-visible,
  .item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .who-name {
    overflow: hidden;
    font-size: 15px;
    line-height: 22px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .who-sub {
    overflow: hidden;
    font-size: 12px;
    line-height: 16px;
    color: var(--text-muted);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 40px;
    padding: 0 10px;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    color: var(--text-primary);
    background-color: transparent;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
  }
  .item:hover { background-color: var(--surface-2); }

  @media (max-width: 639px) {
    .item { min-height: 44px; }
    /* 44px target around the 32px avatar. */
    .avatar::after {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .avatar { overflow: visible; }
    .avatar img { border-radius: 50%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .avatar { transition: none; }
  }
</style>
