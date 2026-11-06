<script>
  // An inline link in prose. Tailwind's preflight makes links inherit color
  // and drop the underline, so prose links set both back, as on /privacy.
  export let href;
  let className = '';
  export { className as class };
</script>

<a {href} class="text-link {className}" {...$$restProps}><slot /></a>

<style>
  .text-link {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;
    border-radius: 4px;
  }
  .text-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
