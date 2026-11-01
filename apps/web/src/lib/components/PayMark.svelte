<script lang="ts">
  // A payment method's mark: its bank's logo on a small white chip, so it reads
  // on light and dark surfaces alike, or for a bank without a logo (and for
  // payment links) a monogram of the method's label, the same size. Logos are
  // trademarks, used only to show which app a QR is for; they are scaled,
  // never recoloured or cropped.
  import { institutionById, monogramOf } from '#lib/pay-institutions.js';

  /** Registry id of the method's bank; absent for an unknown bank or a link. */
  export let institution: string | null | undefined = undefined;
  /** The method's label: the monogram's letter, and the logo's alt text unless `alt` is set. */
  export let label: string;
  /** Chip height in px. */
  export let size = 28;
  /** Empty when something else already names the method (an aria-label, a caption). */
  export let alt: string | null = null;

  $: info = institutionById(institution);
  $: logo = info?.logo ? info : null;
  // A wordmark is wide, so it is set smaller than a round mark to look the same weight.
  $: h = Math.round(size * (logo?.wordmark ? 0.42 : 0.72));
  $: w = Math.round(h * (logo?.aspect ?? 1));
  // What the mark depicts: the bank for a logo, the label for a monogram.
  $: name = alt ?? (logo ? logo.name : label);
</script>

{#if logo}
  <span class="pay-mark pay-logo" style="height: {size}px; min-width: {size}px; padding: 0 {Math.round(size / 5)}px;">
    <img src={logo.logo} alt={name} width={w} height={h} draggable="false" />
  </span>
{:else}
  <span class="pay-mark pay-monogram" style="width: {size}px; height: {size}px; font-size: {Math.round(size * 0.45)}px;"
        role={name ? 'img' : undefined} aria-label={name || undefined} aria-hidden={name ? undefined : 'true'}>{monogramOf(label)}</span>
{/if}

<style>
  .pay-mark {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  }
  .pay-logo {
    background-color: #ffffff;
    /* Keeps the chip's edge on a white surface; invisible on dark ones. */
    border: 1px solid rgb(0 0 0 / 0.08);
  }
  .pay-logo img {
    display: block;
    object-fit: contain;
  }
  .pay-monogram {
    font-weight: 500;
    line-height: 1;
    color: var(--text-muted);
    background-color: var(--surface);
    border: 1px solid var(--border);
    user-select: none;
  }
</style>
