<script>
  // The page is shared with the other short-link route; see LinkPage.
  import LinkPage from '#lib/components/LinkPage.svelte';

  let { data, form } = $props();
</script>

<LinkPage {data} {form} />
