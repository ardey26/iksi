<script>
  // One row per feature, one column per product. Values come from the facts
  // file only. Competitor cells link the vendor page the value was read from.
  import { FEATURES, PRODUCTS, formatDay } from '#lib/marketing/facts.js';
  import { Badge, Paper } from '#lib/ui/index.js';

  /** @type {import('#lib/marketing/facts.js').ProductId[]} */
  export let columns = ['iksi'];
  /** Link each competitor header to its /alternatives page. */
  export let linkHeaders = false;

  const day = formatDay;

  /** @param {import('#lib/marketing/facts.js').IksiFact} fact */
  function iksiBadge(fact) {
    if (!fact.offered) return null;
    if (fact.forever) return { text: 'Free forever', variant: 'success' };
    return fact.plan === 'free' ? { text: 'Free', variant: 'success' } : { text: 'Paid', variant: 'neutral' };
  }
</script>

<Paper padding="none" class="table-paper">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="scroll" tabindex="0" role="region" aria-label="Feature comparison">
    <table style="--columns: {columns.length}">
      <caption class="t-caption">
        {columns.map((id) => `${PRODUCTS[id].name} checked ${day(PRODUCTS[id].verified)}`).join('. ')}.
      </caption>
      <thead>
        <tr>
          <th scope="col" class="feature t-label">Feature</th>
          {#each columns as id (id)}
            <th scope="col" data-product={id} class="t-label">
              {#if linkHeaders && id !== 'iksi'}
                <a href="/alternatives/{id}">{PRODUCTS[id].name}</a>
              {:else}
                {PRODUCTS[id].name}
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each FEATURES as f (f.id)}
          <tr data-feature={f.id}>
            <th scope="row" class="feature t-body">{f.label}</th>
            {#each columns as id (id)}
              <td data-product={id}>
                {#if id === 'iksi'}
                  {@const badge = iksiBadge(f.iksi)}
                  {#if badge}
                    <Badge variant={badge.variant}>{badge.text}</Badge>
                    <span class="value">{f.iksi.value}</span>
                  {:else}
                    <span class="t-faint">Not offered</span>
                  {/if}
                {:else if f.competitors[id]}
                  <span class="value">{f.competitors[id].value}</span>
                  <a
                    class="source"
                    href={f.competitors[id].source}
                    rel="nofollow noopener"
                    aria-label="{PRODUCTS[id].name} source for {f.label}">Source</a
                  >
                {:else}
                  <span class="t-faint">Not listed</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Paper>

<style>
  .scroll {
    overflow-x: auto;
    border-radius: inherit;
  }
  .scroll:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  table {
    width: 100%;
    /* The feature column plus room for each product, so six columns still read
       as sentences. The box scrolls sideways when the page is narrower. */
    min-width: max(640px, calc(160px + var(--columns) * 168px));
    border-collapse: separate;
    border-spacing: 0;
    font-size: 14px;
    line-height: 20px;
  }
  caption {
    caption-side: bottom;
    padding: 12px 16px;
    text-align: left;
    color: var(--text-muted);
  }
  th,
  td {
    padding: 12px 16px;
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
  }
  thead th {
    color: var(--text-muted);
    white-space: nowrap;
  }
  th.feature {
    position: sticky;
    left: 0;
    z-index: 1;
    width: 160px;
    min-width: 160px;
    background-color: var(--surface);
    border-right: 1px solid var(--border);
    font-weight: 500;
  }
  td :global(.badge) {
    margin-bottom: 4px;
  }
  .value {
    display: block;
    color: var(--text-primary);
  }
  .source {
    display: inline-block;
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .source:hover,
  th a:hover {
    color: var(--text-primary);
  }
  .source:focus-visible,
  th a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }
  th a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
