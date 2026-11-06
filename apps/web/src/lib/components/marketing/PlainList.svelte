<script>
  // A bulleted or numbered list for marketing page prose. Callers pass <li>s.
  export let ordered = false;
</script>

{#if ordered}
  <ol class="plain"><slot /></ol>
{:else}
  <ul class="plain"><slot /></ul>
{/if}

<style>
  .plain {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 12px;
  }
</style>
