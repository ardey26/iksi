<script>
  // The home page's poster wordmark: "iksi" set huge, with the brand mark as
  // the dot of the first i. The mark's two links close their gap once a link
  // is made. Size it with --wordmark-size on a parent.
  //
  // Geometry is Geist Bold's own (units per em 1000, at wght 700): ascent
  // 1005, descent 295, dotless i stem centred 140.6 from the glyph origin,
  // x-height 536, and the real dot's bottom at 601.6. With line-height 1 the
  // baseline sits 0.145em above the box bottom, so the mark's bottom is
  // 0.145 + 0.6016 = 0.7466em up. The mark is 0.19em across (the real dot is
  // 0.121em), centred on the stem: left = 0.1406 - 0.095 = 0.0456em.
  /** True once a link is made. */
  export let joined = false;
  import { resolve } from '$app/paths';

  /** True while a link is being made: the links reach for each other and back. */
  export let loading = false;
</script>

<a href={resolve('/')} class="wordmark" class:joined class:loading={loading && !joined} aria-label="iksi home" data-ui>
  <span class="i"
    >ı<svg class="mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="currentColor" />
      <g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.6" fill="none">
        <rect class="link left" x="4" y="10" width="7" height="4" rx="2" />
        <rect class="link right" x="13" y="10" width="7" height="4" rx="2" />
      </g>
    </svg></span
  >ksi
</a>

<style>
  .wordmark {
    display: block;
    width: max-content;
    /* Optical alignment: the i's left side bearing is 0.066em. */
    margin-left: -0.06em;
    /* The baseline lands 0.03em below the box that crops it, so the letters
       stand on the fold line. */
    margin-bottom: -0.175em;
    font-size: var(--wordmark-size, 40vw);
    line-height: 1;
    font-weight: 700;
    letter-spacing: -0.065em;
    color: var(--text-primary);
    text-decoration: none;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .wordmark:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 8px;
  }
  .i {
    position: relative;
    display: inline-block;
    line-height: 1;
  }
  .mark {
    position: absolute;
    left: 0.0456em;
    bottom: 0.7466em;
    width: 0.19em;
    height: 0.19em;
    overflow: visible;
  }
  .link { transition: transform var(--duration-slow) var(--ease-out); }
  .joined .left { transform: translateX(2px); }
  .joined .right { transform: translateX(-2px); }
  /* Waiting: the links reach for each other and pull back, until they join. */
  .loading .left { animation: reach-left 600ms var(--ease-out) infinite alternate; }
  .loading .right { animation: reach-right 600ms var(--ease-out) infinite alternate; }
  @keyframes reach-left { to { transform: translateX(1.5px); } }
  @keyframes reach-right { to { transform: translateX(-1.5px); } }
  @media (prefers-reduced-motion: reduce) {
    .link { transition: none; }
    .loading .left,
    .loading .right { animation: none; }
  }
</style>
