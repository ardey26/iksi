<script>
  import ComparisonTable from '#lib/components/marketing/ComparisonTable.svelte';
  import PlainList from '#lib/components/marketing/PlainList.svelte';
  import { GAPS, competitorIds } from '#lib/marketing/facts.js';
  import { hubCopy } from '#lib/marketing/alternatives.js';
  import { Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  const copy = hubCopy();
  const columns = ['iksi', ...competitorIds()];
</script>

<Container width="wide">
  <PageHeader title="Compare iksi with other link tools" description={copy.answer} />
  <ComparisonTable {columns} linkHeaders />

  <Section title="Where iksi falls short" class="block">
    <Paper>
      <PlainList>
        {#each GAPS as gap (gap)}
          <li class="t-body">{gap}</li>
        {/each}
      </PlainList>
    </Paper>
  </Section>
</Container>
