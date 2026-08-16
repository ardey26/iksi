<script lang="ts">
  import '../../app.css';
  export let data;
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen" style="background: var(--bg); color: var(--text-primary);">
  <div class="flex items-center justify-between px-6 pt-6">
    <a href="/dashboard" class="flex items-center gap-2" style="color: var(--text-muted);">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
          <rect x="4" y="10" width="7" height="4" rx="2" />
          <rect x="13" y="10" width="7" height="4" rx="2" />
        </g>
      </svg>
      <span class="text-sm font-medium tracking-tight">iksi</span>
    </a>
    <div class="flex items-center gap-4 text-sm" style="color: var(--text-muted);">
      {#if data.user.handle}
        <a href={`/@${data.user.handle}`} class="hover:opacity-70">/@{data.user.handle}</a>
      {/if}
      <form method="POST" action="/logout">
        <button type="submit" style="color: var(--text-muted); background: transparent; border: none; cursor: pointer;">Sign out</button>
      </form>
    </div>
  </div>

  <main class="px-6 py-8">
    <slot />
  </main>
</div>
