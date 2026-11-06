<script>
  import ComparisonTable from '#lib/components/marketing/ComparisonTable.svelte';
  import { competitorIds } from '#lib/marketing/facts.js';
  import { hubCopy } from '#lib/marketing/alternatives.js';
  import { Container, PageHeader } from '#lib/ui/index.js';

  const copy = hubCopy();
  const columns = ['iksi', ...competitorIds()];
</script>

<Container width="wide">
  <PageHeader title="Compare iksi with other link tools" description={copy.answer} />
  <ComparisonTable {columns} linkHeaders />
</Container>
