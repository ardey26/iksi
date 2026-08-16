<script lang="ts">
  let password = '';
  let error = '';
  let loading = false;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true; error = '';
    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const body = await res.json();
      if (body.success) window.location.href = '/admin';
      else error = body.error || 'Invalid password';
    } catch {
      error = 'Login failed.';
    } finally {
      loading = false;
    }
  }
</script>

<section class="max-w-sm mx-auto pt-24" aria-label="Admin login">
  <h1 class="text-lg mb-6" style="color: var(--text-primary);">Sign in</h1>
  <form on:submit={submit} class="space-y-4">
    <label class="block">
      <span class="sr-only">Password</span>
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        class="w-full text-lg px-4 py-3 rounded-md outline-none transition-colors"
        style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);"
        autocomplete="current-password"
        required
      />
    </label>
    {#if error}
      <p class="text-sm" style="color: var(--error);">{error}</p>
    {/if}
    <button
      type="submit"
      disabled={loading || !password}
      class="w-full text-base font-medium px-4 py-3 rounded-md transition-colors"
      style="background: var(--accent); color: white;"
    >
      {loading ? 'Signing in…' : 'Sign in'}
    </button>
  </form>
</section>
