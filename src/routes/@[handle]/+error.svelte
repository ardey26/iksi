<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center px-4"
     style="background: var(--bg); color: var(--text-primary);">
  <div class="text-center space-y-2">
    <h1 class="text-lg font-medium">{$page.status}</h1>
    <p class="text-sm" style="color: var(--text-muted);">This handle does not exist.</p>
    <a href="/" class="text-sm underline" style="color: var(--accent);">Back to iksi</a>
  </div>
</div>
