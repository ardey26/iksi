<script lang="ts">
  // A payment method's mark: its bank's logo, straight on the surface (kit
  // Logo, transparent artwork, no chip), or for a bank without a logo (and for
  // payment links) a kit Monogram of the method's label, the same size. Logos
  // are trademarks, used only to show which app a QR is for; they are scaled,
  // never recoloured or cropped.
  import { Logo, Monogram } from '#lib/ui/index.js';
  import { institutionById } from '#lib/pay-institutions.js';

  /** Registry id of the method's bank; absent for an unknown bank or a link. */
  export let institution: string | null | undefined = undefined;
  /** The method's label: the monogram's letter, and the logo's alt text unless `alt` is set. */
  export let label: string;
  /** Box size in px (the kit uses 32 and 40). */
  export let size = 32;
  /** Empty when something else already names the method (an aria-label, a caption). */
  export let alt: string | null = null;

  $: info = institutionById(institution);
  $: logo = info?.logo ? info : null;
  // What the mark depicts: the bank for a logo, the label for a monogram.
  $: name = alt ?? (logo ? logo.name : label);
</script>

{#if logo}
  <span class="pay-mark pay-logo">
    <Logo src={logo.logo} alt={name} {size} />
  </span>
{:else}
  <span class="pay-mark pay-monogram" role={name ? 'img' : undefined} aria-label={name || undefined}>
    <Monogram name={label} {size} />
  </span>
{/if}

<style>
  .pay-mark {
    display: inline-flex;
    flex: none;
  }
</style>
