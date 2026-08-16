<script lang="ts">
  export let data;

  let copied = false;
  async function copyProfileUrl() {
    try {
      await navigator.clipboard.writeText(`https://iksi.app/@${data.handle}`);
      copied = true;
      setTimeout(() => (copied = false), 1400);
    } catch {}
  }

  function fmtClicks(n: number) {
    if (n < 1000) return n.toString();
    if (n < 10000) return (n / 1000).toFixed(1) + 'k';
    if (n < 1000000) return Math.round(n / 1000) + 'k';
    return (n / 1000000).toFixed(1) + 'M';
  }
</script>

<svelte:head>
  <title>@{data.handle} — iksi</title>
  <meta name="description" content={data.bio ?? `@${data.handle} on iksi`} />
</svelte:head>

<div class="min-h-screen flex flex-col items-center px-4 pt-20 pb-8"
     style={`background: var(--bg); color: var(--text-primary); --accent: ${data.accent};`}
     data-theme={data.theme}>

  <!-- Share button top-right -->
  <button
    on:click={copyProfileUrl}
    class="absolute top-6 right-6 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-100 opacity-70"
    style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;"
    aria-label="Copy profile link"
  >
    {#if copied}
      <span>copied</span>
    {:else}
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342l6.632 3.316m0-9.316L8.684 10.658m8.632-3l-1.632-1.632a2 2 0 10-2.828 2.828L14.488 10.658m1.828 5.684l1.632 1.632a2 2 0 11-2.828 2.828l-1.632-1.632"/>
      </svg>
      <span>Share</span>
    {/if}
  </button>

  <div class="max-w-md w-full text-center space-y-6 flex-1">
    <!-- Avatar -->
    {#if data.avatarUrl}
      <img src={data.avatarUrl} alt="" class="w-24 h-24 rounded-full mx-auto object-cover"
           style="border: 1px solid var(--border);" />
    {:else}
      <div class="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-2xl font-medium"
           style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);">
        {data.displayName[0].toUpperCase()}
      </div>
    {/if}

    <!-- Identity -->
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">{data.displayName}</h1>
      <p class="text-sm" style="color: var(--text-muted);">@{data.handle}</p>
    </div>

    <!-- Bio -->
    {#if data.bio}
      <p class="text-sm leading-relaxed max-w-sm mx-auto" style="color: var(--text-muted);">{data.bio}</p>
    {/if}

    <!-- Rows -->
    {#if data.rows.length === 0}
      <p class="text-sm py-8" style="color: var(--text-muted);">Nothing here yet.</p>
    {:else}
      <ul class="w-full space-y-3 pt-2">
        {#each data.rows as row}
          {#if row.href}
            <li>
              <a href={row.href}
                 class="group flex items-center justify-between w-full text-left px-5 py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.99]"
                 style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
                <span class="text-base font-medium truncate">{row.title}</span>
                {#if row.clicks !== null && row.clicks !== undefined}
                  <span class="text-xs tabular-nums shrink-0 ml-3 opacity-60" style="color: var(--text-muted);">
                    {fmtClicks(row.clicks)}
                  </span>
                {/if}
              </a>
            </li>
          {:else}
            <li class="flex items-center justify-between w-full px-5 py-4 rounded-xl"
                style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); opacity: 0.5;">
              <span class="text-base truncate">{row.title}</span>
              <span class="text-xs shrink-0 ml-3">unavailable</span>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Made with iksi -->
  <a
    href="https://iksi.app/"
    target="_blank"
    rel="noopener"
    class="mt-16 flex items-center gap-1.5 text-xs opacity-50 hover:opacity-100 transition-opacity"
    style="color: var(--text-muted);"
    aria-label="Made with iksi"
  >
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
        <rect x="4" y="10" width="7" height="4" rx="2" />
        <rect x="13" y="10" width="7" height="4" rx="2" />
      </g>
    </svg>
    <span class="tracking-tight">made with iksi</span>
  </a>
</div>
