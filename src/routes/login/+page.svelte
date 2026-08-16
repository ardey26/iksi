<script lang="ts">
  let submitting = false;
  function submit() { submitting = true; }
</script>

<svelte:head><title>Sign in — iksi</title></svelte:head>

<section class="max-w-sm mx-auto pt-24 px-4">
  <h1 class="text-lg mb-6" style="color: var(--text-primary);">Sign in</h1>
  <form method="POST" on:submit={submit}>
    <button
      type="submit"
      disabled={submitting}
      class="w-full text-base font-medium px-4 py-3 rounded-md"
      style="background: var(--accent); color: white;"
    >
      {submitting ? 'Redirecting…' : 'Sign in with Twitter'}
    </button>
  </form>
</section>
