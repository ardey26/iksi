<script lang="ts">
  import { page } from '$app/state';

  const missing = $derived(page.status === 404);
</script>

<!-- The root layout skips its <SEO> on /@ routes, so this page sets its own head. -->
<svelte:head>
  <title>{missing ? 'Handle not found' : 'Something went wrong'} — iksi</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4"
     style="background: var(--bg); color: var(--text-primary);">
  <div class="text-center space-y-2">
    <h1 class="text-lg font-medium">{page.status}</h1>
    <p class="text-sm" style="color: var(--text-muted);">{missing ? 'This handle does not exist.' : 'Try again in a moment.'}</p>
    <a href="/" class="text-sm underline" style="color: var(--accent);">Back to iksi</a>
  </div>
</div>
