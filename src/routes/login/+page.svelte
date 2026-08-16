<script lang="ts">
  let submitting = false;
  function submit() { submitting = true; }
</script>

<svelte:head><title>Sign in — iksi</title></svelte:head>

<section class="w-full max-w-md mx-auto px-4">
  <div class="text-center space-y-3 mb-10">
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">
      Sign in to iksi
    </h1>
    <p class="text-base leading-relaxed" style="color: var(--text-muted);">
      Claim your handle, own your short links,<br />
      and turn <span style="color: var(--text-primary);">iksi.app/@you</span> into your public page.
    </p>
  </div>

  <form method="POST" on:submit={submit}>
    <button
      type="submit"
      disabled={submitting}
      class="w-full flex items-center justify-center gap-3 text-base font-medium px-4 py-4 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60"
      style="background: var(--text-primary); color: var(--bg);"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      <span>{submitting ? 'Redirecting to X…' : 'Continue with X'}</span>
    </button>
  </form>

</section>
