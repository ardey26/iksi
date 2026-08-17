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

  // `theme` column stores brightness as string "0".."100".
  // Legacy: 'light' → 100, everything else → 20.
  function brightnessOf(t) {
    if (!t) return 20;
    const n = parseInt(t, 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
    if (t === 'light') return 100;
    return 20;
  }
  $: b = brightnessOf(data.theme);
  $: surfB = Math.max(0, Math.min(100, b + 6));
  $: invB = 100 - b;
  $: paletteStyle =
    `--accent: ${data.accent};
     --bg: color-mix(in srgb, ${data.accent} 8%, color-mix(in srgb, #fff ${b}%, #000));
     --surface: color-mix(in srgb, ${data.accent} 14%, color-mix(in srgb, #fff ${surfB}%, #000));
     --border: color-mix(in srgb, ${data.accent} 28%, transparent);
     --text-primary: color-mix(in srgb, color-mix(in srgb, #fff ${invB}%, #000) 95%, ${data.accent} 5%);
     --text-muted: color-mix(in srgb, color-mix(in srgb, #fff ${invB}%, #000) 55%, ${data.accent} 45%);`;
</script>

<svelte:head>
  <title>@{data.handle} — iksi</title>
  <meta name="description" content={data.bio ?? `@${data.handle} on iksi`} />
</svelte:head>

<!--
  The whole palette on the public page is derived from the user's chosen accent hex
  + dark/light mode. All via CSS color-mix — no per-hex classes needed.
-->
<div class="iksi-profile min-h-screen flex flex-col items-center px-4 pt-20 pb-8"
     style="{paletteStyle} background: var(--bg); color: var(--text-primary);">

  <!-- Share button top-right -->
  <button
    on:click={copyProfileUrl}
    class="absolute top-6 right-6 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-100 opacity-70"
    style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer;"
    aria-label="Copy profile link"
  >
    {#if copied}
      <span>Copied</span>
    {:else}
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
