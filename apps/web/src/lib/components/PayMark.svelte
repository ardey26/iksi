<script lang="ts">
  // A payment method's mark: its bank's logo, straight on the surface (kit
  // Logo, transparent artwork, no chip) or a payment link provider's. One
  // without a logo gets a bare kit icon of what it is, a QR or a wallet, in
  // the same box. Logos are trademarks, used only to show which app a QR is
  // for; they are scaled, never recoloured or cropped.
  import { Logo, MediaIcon } from '#lib/ui/index.js';
  import { institutionById, providerBrand } from '#lib/pay-institutions.js';

  /** Registry id of the method's bank; absent for an unknown bank or a link. */
  export let institution: string | null | undefined = undefined;
  /** Provider of a payment link (PayPal, Wise), for its logo when it has one. Set only for links. */
  export let provider: string | null | undefined = undefined;
  /** The method's label: the mark's accessible name unless `alt` is set. */
  export let label: string;
  /** Box size in px (the kit uses 32 and 40). */
  export let size = 32;
  /** Empty when something else already names the method (an aria-label, a caption). */
  export let alt: string | null = null;

  $: info = institutionById(institution) ?? providerBrand(provider);
  $: logo = info?.logo ? info : null;
  // What the mark depicts: the bank for a logo, the method for an icon.
  $: name = alt ?? (logo ? logo.name : label);
</script>

{#if logo}
  <span class="pay-mark pay-logo">
    <Logo src={logo.logo} alt={name} {size} wordmark={!!logo.wordmark} />
  </span>
{:else}
  <span class="pay-mark pay-icon">
    <MediaIcon name={provider ? 'wallet' : 'qr'} label={name} {size} />
  </span>
{/if}

<style>
  .pay-mark {
    display: inline-flex;
    flex: none;
  }
</style>
