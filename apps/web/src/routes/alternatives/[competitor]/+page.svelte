<script>
  import ComparisonTable from '#lib/components/marketing/ComparisonTable.svelte';
  import { GAPS, PRODUCTS } from '#lib/marketing/facts.js';
  import { alternativeCopy } from '#lib/marketing/alternatives.js';
  import { Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  export let data;

  $: id = data.id;
  $: name = PRODUCTS[id].name;
  $: copy = alternativeCopy(id);
</script>

<Container width="wide">
  <PageHeader title="iksi as a {name} alternative" description={copy.answer} />

  <Section title="How iksi compares with {name}" description="Each {name} value is for its free plan." class="block">
    <ComparisonTable columns={['iksi', id]} />
  </Section>

  <Section title="Where iksi falls short" class="block">
    <Paper>
      <ul class="plain">
        {#each GAPS as gap (gap)}
          <li class="t-body">{gap}</li>
        {/each}
      </ul>
    </Paper>
  </Section>

  <Section title="How to switch" class="block">
    <Paper>
      <ol class="plain">
        {#each copy.switchSteps as step (step)}
          <li class="t-body">{step}</li>
        {/each}
      </ol>
    </Paper>
  </Section>

  <Section title="Questions" class="block">
    <Paper>
      <dl class="faq">
        {#each copy.faq as item (item.q)}
          <dt class="t-label">{item.q}</dt>
          <dd class="t-body">{item.a}</dd>
        {/each}
      </dl>
    </Paper>
  </Section>
</Container>

<style>
  .plain {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 12px;
  }
  .faq {
    margin: 0;
    display: grid;
    gap: 4px;
  }
  .faq dt {
    margin-top: 16px;
    color: var(--text-primary);
  }
  .faq dt:first-child {
    margin-top: 0;
  }
  .faq dd {
    margin: 0;
    color: var(--text-muted);
  }
</style>
