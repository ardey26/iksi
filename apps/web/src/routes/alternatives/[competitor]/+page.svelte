<script>
  import ComparisonTable from '#lib/components/marketing/ComparisonTable.svelte';
  import Faq from '#lib/components/marketing/Faq.svelte';
  import PlainList from '#lib/components/marketing/PlainList.svelte';
  import { GAPS, PRODUCTS } from '#lib/marketing/facts.js';
  import { alternativeCopy } from '#lib/marketing/alternatives.js';
  import { Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  export let data;

  $: id = data.id;
  $: name = PRODUCTS[id].name;
  $: copy = alternativeCopy(id);
</script>

<Container width="wide" class="marketing">
  <PageHeader title="iksi as a {name} alternative" description={copy.answer} />

  <Section title="How iksi compares with {name}" description="Each {name} value is for its free plan." class="block">
    <ComparisonTable columns={['iksi', id]} />
  </Section>

  <Section title="Where iksi falls short" class="block">
    <Paper>
      <PlainList>
        {#each GAPS as gap (gap)}
          <li class="t-body">{gap}</li>
        {/each}
      </PlainList>
    </Paper>
  </Section>

  <Section title="How to switch" class="block">
    <Paper>
      <PlainList ordered>
        {#each copy.switchSteps as step (step)}
          <li class="t-body">{step}</li>
        {/each}
      </PlainList>
    </Paper>
  </Section>

  <Faq items={copy.faq} />
</Container>
