<script>
  // The Questions block on marketing pages. The same items feed the page's
  // FAQPage structured data, so what is read matches what is marked up.
  import { Paper, Section } from '#lib/ui/index.js';

  /** @type {{ q: string, a: string }[]} */
  export let items = [];
  export let title = 'Questions';
</script>

<Section {title} class="block">
  <Paper>
    <dl class="faq">
      {#each items as item (item.q)}
        <dt class="t-label">{item.q}</dt>
        <dd class="t-body">{item.a}</dd>
      {/each}
    </dl>
  </Paper>
</Section>

<style>
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
