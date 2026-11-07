<script>
  import Faq from '#lib/components/marketing/Faq.svelte';
  import PlainList from '#lib/components/marketing/PlainList.svelte';
  import TextLink from '#lib/components/marketing/TextLink.svelte';
  import { PRODUCTS, formatDay } from '#lib/marketing/facts.js';
  import { FEATURE_PAGES, featureFacts, planLabel } from '#lib/marketing/features.js';
  import { Badge, Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  export let data;

  $: copy = FEATURE_PAGES[data.slug];
  $: plan = planLabel(data.slug);
  $: facts = featureFacts(data.slug);
</script>

<Container width="wide" class="marketing">
  <PageHeader title={copy.label} description={copy.answer} />

  <Section title="What iksi offers" class="block">
    <Paper>
      <PlainList>
        {#if plan}
          <li class="t-body">Plan: <span data-plan><Badge>{plan}</Badge></span>, checked {formatDay(PRODUCTS.iksi.verified)}</li>
        {/if}
        {#each facts as fact (fact.label)}
          <li class="t-body">{fact.value}</li>
        {/each}
        <li class="t-body">{copy.limit}</li>
      </PlainList>
    </Paper>
  </Section>

  <Section title="How to set it up" class="block">
    <Paper>
      <PlainList ordered>
        {#each copy.steps as step (step)}
          <li class="t-body">{step}</li>
        {/each}
      </PlainList>
    </Paper>
  </Section>

  {#if copy.example}
    <Section title="See it live" class="block">
      <Paper>
        <div data-example>
          <p class="t-body">{copy.example.note}</p>
          <TextLink class="t-mono" href="https://www.iksi.app/{copy.example.shortURL}">iksi.app/{copy.example.shortURL}</TextLink>
        </div>
      </Paper>
    </Section>
  {/if}

  <Faq items={copy.faq} />

  <Section title="More" class="block">
    <Paper>
      <PlainList>
        <li class="t-body"><TextLink href="/">Shorten a link with iksi</TextLink></li>
        <li class="t-body"><TextLink href="/alternatives">Compare iksi with other tools</TextLink></li>
      </PlainList>
    </Paper>
  </Section>
</Container>
