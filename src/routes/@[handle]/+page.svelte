<script lang="ts">
  export let data;
</script>

<svelte:head>
  <title>@{data.handle} — iksi</title>
  <meta name="description" content={data.bio ?? `@${data.handle} on iksi`} />
</svelte:head>

<div class="min-h-screen flex flex-col items-center px-4 py-16"
     style={`background: var(--bg); color: var(--text-primary); --accent: ${data.accent};`}
     data-theme={data.theme}>
  <div class="max-w-md w-full text-center space-y-6">
    {#if data.avatarUrl}
      <img src={data.avatarUrl} alt="" class="w-20 h-20 rounded-full mx-auto object-cover"
           style="border: 1px solid var(--border);" />
    {:else}
      <div class="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-xl"
           style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);">
        {data.displayName[0].toUpperCase()}
      </div>
    {/if}

    <div>
      <h1 class="text-lg font-medium">{data.displayName}</h1>
      <p class="text-sm" style="color: var(--text-muted);">@{data.handle}</p>
    </div>

    {#if data.bio}
      <p class="text-sm" style="color: var(--text-muted);">{data.bio}</p>
    {/if}

    <ul class="w-full space-y-3">
      {#each data.rows as row}
        {#if row.href}
          <li>
            <a href={row.href}
               class="block w-full text-base font-medium px-4 py-3 rounded-md text-center transition-opacity hover:opacity-80"
               style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
              {row.title}
            </a>
          </li>
        {:else}
          <li class="block w-full text-base px-4 py-3 rounded-md text-center"
              style="background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); opacity: 0.6;">
            {row.title} <span class="text-xs">— link removed</span>
          </li>
        {/if}
      {/each}
      {#if data.rows.length === 0}
        <li class="text-sm text-center" style="color: var(--text-muted);">No links yet.</li>
      {/if}
    </ul>
  </div>
</div>
