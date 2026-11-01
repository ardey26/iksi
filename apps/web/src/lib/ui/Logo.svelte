<script>
  // Brand logos sit on a white chip in both themes, so their colours hold.
  export let src;
  /** Brand name. Empty when a visible label already names it. */
  export let alt = '';
  /** 32 | 40 */
  export let size = 40;
  /** Padding as a share of the chip; lower for wide wordmarks. */
  export let inset = 0.15;
</script>

<span class="logo" style="--size: {size}px; --inset: {inset};">
  <img {src} {alt} width={size} height={size} loading="lazy" decoding="async" />
</span>

<style>
  .logo {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--size);
    height: var(--size);
    padding: calc(var(--size) * var(--inset));
    overflow: hidden;
    background-color: var(--chip);
    border-radius: var(--radius-control);
    box-shadow: inset 0 0 0 1px var(--chip-border);
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
