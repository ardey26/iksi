<script>
  // Header control. The icon is the theme you would switch to.
  import { theme, toggleTheme } from '#lib/stores/theme.js';
  import { IconButton } from '#lib/ui/index.js';
</script>

<IconButton icon={$theme === 'light' ? 'moon' : 'sun'} label="Toggle theme" on:click={toggleTheme} />
