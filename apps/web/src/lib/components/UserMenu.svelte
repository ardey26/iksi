<script lang="ts">
  import { onMount } from 'svelte';

  export let user: {
    twitterHandle: string | null;
    googleEmail?: string | null;
    handle: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };

  let menuOpen = false;
  let menuRoot: HTMLDivElement;

  function toggle() { menuOpen = !menuOpen; }
  function close() { menuOpen = false; }

  onMount(() => {
    function onClick(e: MouseEvent) {
      if (menuRoot && !menuRoot.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  });

  $: identityLabel = user.twitterHandle
    ? `@${user.twitterHandle}`
    : (user.googleEmail ?? '');
  $: initial = (user.displayName || user.handle || user.twitterHandle || user.googleEmail || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
</script>

<div bind:this={menuRoot} class="relative">
  <button
    type="button"
    on:click|stopPropagation={toggle}
    aria-haspopup="menu"
    aria-expanded={menuOpen}
    aria-label="Account menu"
    class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-opacity hover:opacity-80"
    style="background: var(--surface); border: 1px solid var(--border);"
  >
    {#if user.avatarUrl}
      <img src={user.avatarUrl} alt="" class="w-full h-full object-cover" />
    {:else}
      <span class="text-sm font-medium" style="color: var(--text-muted);">{initial}</span>
    {/if}
  </button>

  {#if menuOpen}
    <div
      role="menu"
      class="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50"
      style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.24);"
    >
      <div class="px-4 py-3" style="border-bottom: 1px solid var(--border);">
        {#if user.handle}
          <a
            href={`/@${user.handle}`}
            class="block text-sm font-medium hover:opacity-70 transition-opacity"
            style="color: var(--text-primary);"
            on:click={close}
          >@{user.handle}</a>
          <p class="text-xs mt-0.5" style="color: var(--text-muted);">
            iksi.app/@{user.handle}
          </p>
        {:else if identityLabel}
          <span class="text-sm truncate block" style="color: var(--text-muted);">{identityLabel}</span>
        {/if}
      </div>
      <a
        href="/dashboard"
        class="block px-4 py-2.5 text-sm hover:opacity-70 transition-opacity"
        style="color: var(--text-primary);"
        on:click={close}
      >Dashboard</a>
      <form method="POST" action="/logout" style="border-top: 1px solid var(--border);">
        <button
          type="submit"
          class="w-full text-left px-4 py-2.5 text-sm hover:opacity-70 transition-opacity"
          style="color: var(--text-primary); background: transparent; border: none; cursor: pointer;"
        >Sign out</button>
      </form>
    </div>
  {/if}
</div>
