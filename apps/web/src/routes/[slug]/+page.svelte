<script>
  // The page lives in LinkPage so other short-link routes can share it.
  import LinkPage from '#lib/components/LinkPage.svelte';

  let { data, form } = $props();
</script>

<LinkPage {data} {form} />
