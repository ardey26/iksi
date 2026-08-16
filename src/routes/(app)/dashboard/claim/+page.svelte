<script lang="ts">
  export let data;

  let handle = (data.user.twitterHandle ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  let error = '';
  let loading = false;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    loading = true; error = '';
    try {
      const res = await fetch('/dashboard/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      });
      const body = await res.json();
      if (body.ok) window.location.href = '/dashboard';
      else error = body.error || 'Could not claim';
    } catch { error = 'Something went wrong.'; }
    finally { loading = false; }
  }
</script>

<svelte:head><title>Claim your handle — iksi</title></svelte:head>

<section class="max-w-md mx-auto pt-16">
  <h1 class="text-lg mb-2" style="color: var(--text-primary);">Claim your handle</h1>
  <p class="text-sm mb-6" style="color: var(--text-muted);">Your profile will live at iksi.app/@handle. 3–30 characters, lowercase letters/numbers/underscore/hyphen.</p>
  <form on:submit={submit} class="space-y-4">
    <div class="flex items-stretch rounded-md overflow-hidden" style="border: 1px solid var(--border); background: var(--surface);">
      <span class="px-3 py-3 text-sm flex items-center" style="color: var(--text-muted); border-right: 1px solid var(--border);">iksi.app/@</span>
      <input
        type="text"
        bind:value={handle}
        required
        minlength="3"
        maxlength="30"
        class="flex-1 px-3 py-3 outline-none"
        style="background: transparent; color: var(--text-primary);"
      />
    </div>
    {#if error}<p class="text-sm" style="color: var(--error);">{error}</p>{/if}
    <button
      type="submit"
      disabled={loading || handle.length < 3}
      class="w-full text-base font-medium px-4 py-3 rounded-md"
      style="background: var(--accent); color: white;"
    >
      {loading ? 'Claiming…' : 'Claim'}
    </button>
  </form>
</section>
