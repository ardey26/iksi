<script lang="ts">
  import '../../app.css';
</script>

<div class="min-h-screen" style="background: var(--bg); color: var(--text-primary);">
  <header class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--border);">
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium tracking-tight" style="color: var(--text-primary);">iksi admin</span>
    </div>
    <form method="POST" action="/admin/logout">
      <button
        type="submit"
        class="text-sm px-3 py-1.5 rounded-md transition-colors"
        style="color: var(--text-muted); border: 1px solid var(--border);"
      >
        Sign out
      </button>
    </form>
  </header>

  <main class="px-6 py-8 max-w-6xl mx-auto">
    <slot />
  </main>
</div>
