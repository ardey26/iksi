<script>
  import { PRODUCTS, formatDay } from '#lib/marketing/facts.js';
  import { FEATURE_PAGES, featureFacts, planLabel } from '#lib/marketing/features.js';
  import { Badge, Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  export let data;

  $: copy = FEATURE_PAGES[data.slug];
  $: plan = planLabel(data.slug);
  $: facts = featureFacts(data.slug);
</script>

<Container width="wide">
  <PageHeader title={copy.label} description={copy.answer} />

  <Section title="What iksi offers" class="block">
    <Paper>
      <ul class="plain">
        {#if plan}
          <li class="t-body">Plan: <span data-plan><Badge>{plan}</Badge></span>, checked {formatDay(PRODUCTS.iksi.verified)}</li>
        {/if}
        {#each facts as fact (fact.label)}
          <li class="t-body">{fact.value}</li>
        {/each}
        <li class="t-body">{copy.limit}</li>
      </ul>
    </Paper>
  </Section>

  <Section title="How to set it up" class="block">
    <Paper>
      <ol class="plain">
        {#each copy.steps as step (step)}
          <li class="t-body">{step}</li>
        {/each}
      </ol>
    </Paper>
  </Section>

  {#if copy.example}
    <Section title="See it live" class="block">
      <Paper>
        <div data-example>
          <p class="t-body">{copy.example.note}</p>
          <a class="t-mono" href="https://iksi.app/{copy.example.shortURL}">iksi.app/{copy.example.shortURL}</a>
        </div>
      </Paper>
    </Section>
  {/if}

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

  <Section title="More" class="block">
    <Paper>
      <ul class="plain">
        <li class="t-body"><a href="/">Shorten a link with iksi</a></li>
        <li class="t-body"><a href="/alternatives">Compare iksi with other tools</a></li>
      </ul>
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
