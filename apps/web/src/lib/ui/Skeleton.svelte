<script>
  // A placeholder bar at the final layout size. Content loads into exactly
  // this space, so nothing moves.
  /** CSS length. */
  export let width = '100%';
  /** CSS length; match the line-height of the text it stands in for. */
  export let height = '16px';
  /** text | block | circle | square (logo, monogram) */
  export let shape = 'text';
</script>

<span class="skeleton {shape}" style="--w: {width}; --h: {height};" aria-hidden="true"></span>

<style>
  .skeleton {
    display: block;
    flex: none;
    width: var(--w);
    max-width: 100%;
    height: var(--h);
    background-color: var(--skeleton);
    border-radius: 6px;
    animation: ui-pulse 1600ms var(--ease-out) infinite;
  }
  /* A text bar is drawn at the glyph height, centred in its line. */
  .text {
    height: calc(var(--h) * 0.7);
    margin: calc(var(--h) * 0.15) 0;
    border-radius: 4px;
  }
  .block { border-radius: var(--radius-control); }
  .square {
    width: var(--h);
    border-radius: var(--radius-control);
  }
  .circle {
    width: var(--h);
    border-radius: 50%;
  }
  @keyframes ui-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; }
  }
</style>
