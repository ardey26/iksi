<script>
  import '../app.css';
  import { ThemeToggle } from '../lib/components';
  import { onMount } from 'svelte';
  import { theme } from '$lib/stores/theme.js';

  onMount(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      theme.set(savedTheme);
    }
  });
</script>

<div class="min-h-screen flex flex-col relative" style="background: var(--bg);">
  <!-- Brand mark: top-left, small, confident -->
  <div class="fixed top-6 left-6 z-50 flex items-center gap-2">
    <!-- Custom iksi mark: pencil in circle -->
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" style="color: var(--text-muted);">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path
        d="M7 17L7.5 14.5L15.5 6.5L17.5 8.5L9.5 16.5L7 17Z"
        stroke="var(--bg)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
    <span class="text-sm font-medium tracking-tight" style="color: var(--text-muted);">iksi</span>
  </div>

  <!-- Theme toggle: bottom-right -->
  <div class="fixed bottom-6 right-6 z-50">
    <ThemeToggle />
  </div>

  <!-- Main content: centered -->
  <main class="flex-1 flex items-center justify-center px-4">
    <slot />
  </main>
</div>
