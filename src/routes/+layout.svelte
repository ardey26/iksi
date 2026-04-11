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
  <div class="fixed top-6 left-6 z-50 flex items-center gap-1.5">
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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
