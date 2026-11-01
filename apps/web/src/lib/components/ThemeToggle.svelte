<script>
  // Header control. The icon is the theme you would switch to. Both icons are
  // rendered and CSS picks one from <html data-theme>, which app.html sets
  // before first paint: the server cannot know the theme, so choosing in
  // markup would flash, or mismatch on hydration.
  import { toggleTheme } from '#lib/stores/theme.js';
  import { IconButton } from '#lib/ui/index.js';
</script>

<span class="theme-toggle">
  <span class="to-light"><IconButton icon="sun" label="Toggle theme" on:click={toggleTheme} /></span>
  <span class="to-dark"><IconButton icon="moon" label="Toggle theme" on:click={toggleTheme} /></span>
</span>

<style>
  .theme-toggle,
  .theme-toggle > span { display: inline-flex; }
  .to-dark { display: none !important; }
  :global([data-theme='light']) .to-light { display: none !important; }
  :global([data-theme='light']) .to-dark { display: inline-flex !important; }
</style>
