<script>
  // Brand logos sit directly on the surface: transparent artwork, no chip.
  // A round mark gets a square box, so it aligns with monograms; a wordmark
  // (a logo that spells the name) gets a wide box of the same height class,
  // and the name beside it is visually hidden rather than repeated.
  export let src;
  /** Brand name. Empty when a visible label already names it. */
  export let alt = '';
  /** 32 | 40 */
  export let size = 40;
  /** A wide logo that spells the brand name: 64×24 at 40, 48×18 at 32. */
  export let wordmark = false;
  /** Padding as a share of the box, for artwork without its own margin (favicons). */
  export let inset = 0;

  const WORDMARK = { 40: [64, 24], 32: [48, 18] };
  $: [w, h] = wordmark ? (WORDMARK[size] ?? [Math.round(size * 1.6), Math.round(size * 0.6)]) : [size, size];
</script>

<span class="logo" class:wordmark style="--w: {w}px; --h: {h}px; --inset: {inset};">
  <img {src} {alt} width={w} height={h} loading="lazy" decoding="async" />
</span>

<style>
  .logo {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--w);
    height: var(--h);
    padding: calc(var(--h) * var(--inset));
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
