<script>
  import { MARKETING_PAGES } from '#lib/marketing/pages.js';

  const GROUPS = [
    { kind: 'alternatives', heading: 'Compare' },
    { kind: 'feature', heading: 'Features' },
    { kind: 'tool', heading: 'Tools' },
    { kind: 'docs', heading: 'Developers' }
  ];

  // Static data: server and client render the same markup, so no height change.
  const groups = GROUPS.map((g) => ({ ...g, pages: MARKETING_PAGES.filter((p) => p.kind === g.kind) })).filter((g) => g.pages.length > 0);
</script>

<footer class="site-footer">
  <div class="footer-inner">
    {#each groups as group (group.kind)}
      <section class="footer-group" aria-labelledby="footer-{group.kind}">
        <h2 class="t-label footer-heading" id="footer-{group.kind}">{group.heading}</h2>
        <ul class="footer-list">
          {#each group.pages as p (p.path)}
            <li><a class="t-caption footer-link" href={p.path}>{p.label}</a></li>
          {/each}
        </ul>
      </section>
    {/each}
    <section class="footer-group" aria-label="Legal">
      <ul class="footer-list">
        <li><a class="t-caption footer-link" href="/privacy">Privacy</a></li>
      </ul>
    </section>
  </div>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--border);
    padding: 32px var(--gutter);
  }
  .footer-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 32px 48px;
    max-width: 960px;
    margin: 0 auto;
  }
  .footer-group {
    min-width: 140px;
    flex: 1 1 140px;
  }
  .footer-heading {
    margin: 0 0 8px;
    color: var(--text-primary);
  }
  .footer-list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .footer-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: var(--radius-control);
    transition: color var(--duration-normal) var(--ease-out);
  }
  .footer-link:hover { color: var(--text-primary); }
  .footer-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
