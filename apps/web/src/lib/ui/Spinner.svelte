<script>
  /** Inline progress for controls. Content loading uses Skeleton instead. */
  export let size = 16;
</script>

<span class="spinner" style="--size: {size}px;" aria-hidden="true"></span>

<style>
  .spinner {
    display: block;
    flex: none;
    width: var(--size);
    height: var(--size);
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: ui-spin 700ms linear infinite;
  }
  @keyframes ui-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 1600ms; }
  }
</style>
