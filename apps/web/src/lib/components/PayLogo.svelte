<script lang="ts">
  // A wallet's logo on a small white chip, so it reads on light and dark
  // surfaces alike. The logos are trademarks, used only to show which app a
  // QR is for; they are scaled, never recoloured or cropped.
  import { QR_PROVIDER_INFO, type QrProvider } from '#lib/pay-methods.js';

  export let provider: QrProvider;
  /** Chip height in px. */
  export let size = 28;
  /** Empty when something else already names the wallet (an aria-label, a caption). */
  export let alt: string | null = null;

  $: info = QR_PROVIDER_INFO[provider];
  // A wordmark is wide, so it is set smaller than a round mark to look the same weight.
  $: h = Math.round(size * (info.wordmark ? 0.42 : 0.72));
  $: w = Math.round(h * info.aspect);
</script>

<span class="pay-logo" style="height: {size}px; min-width: {size}px; padding: 0 {Math.round(size / 5)}px;">
  <img src={info.logo} alt={alt ?? info.name} width={w} height={h} draggable="false" />
</span>

<style>
  .pay-logo {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    background-color: #ffffff;
    /* Keeps the chip's edge on a white surface; invisible on dark ones. */
    border: 1px solid rgb(0 0 0 / 0.08);
    border-radius: 6px;
  }
  .pay-logo img {
    display: block;
    object-fit: contain;
  }
</style>
