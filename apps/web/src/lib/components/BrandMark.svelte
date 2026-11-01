<script>
  // The iksi mark (DESIGN.md › Brand Mark): two chain links reaching for each
  // other in a filled circle. The circle takes the current colour; the links
  // are stroked in the canvas colour. Decorative: the name sits beside it.
  /** Box size in px. */
  export let size = 20;
</script>

<svg class="brand-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="11" fill="currentColor"></circle>
  <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
    <rect x="4" y="10" width="7" height="4" rx="2"></rect>
    <rect x="13" y="10" width="7" height="4" rx="2"></rect>
  </g>
</svg>

<style>
  .brand-mark {
    display: block;
    flex: none;
  }
</style>
