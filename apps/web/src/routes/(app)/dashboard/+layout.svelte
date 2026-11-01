<script>
  // Dashboard shell: every signed-in page sits in a kit Container, and one
  // toast region serves all of them.
  import { Toast } from '#lib/ui/index.js';
</script>

<div class="dash">
  <slot />
</div>

<Toast />

<style>
  /* The root layout pads <main> by 16px; Container draws the dashboard's own
     gutters (16 phone, 32 from 768), so the outer padding is dropped here. */
  :global(main.dash-main) {
    padding-left: 0;
    padding-right: 0;
  }
  .dash {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
  }
</style>
