<script lang="ts">
  let confirmText = '';
  async function del() {
    if (confirmText !== 'DELETE') { alert('Type DELETE to confirm'); return; }
    const res = await fetch('/dashboard/settings', { method: 'DELETE' });
    if (res.ok) window.location.href = '/';
    else alert('Delete failed');
  }
</script>

<section class="max-w-md mx-auto space-y-8">
  <h1 class="text-xl font-medium" style="color: var(--text-primary);">Settings</h1>

  <form method="POST" action="/logout">
    <button type="submit" class="px-4 py-2 rounded-md text-sm" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);">
      Sign out
    </button>
  </form>

  <div class="space-y-3">
    <h2 class="text-sm uppercase tracking-wide" style="color: var(--error);">Danger zone</h2>
    <p class="text-sm" style="color: var(--text-muted);">Deleting your account removes your handle, profile, and rows. Your shortened links stay live but become ownerless.</p>
    <div class="flex gap-2">
      <input type="text" bind:value={confirmText} placeholder="Type DELETE to confirm" class="flex-1 px-3 py-2 rounded-md" style="background: var(--surface); border: 1px solid var(--border); color: var(--text-primary);" />
      <button on:click={del} class="px-4 py-2 rounded-md text-sm" style="background: var(--error); color: white;">Delete account</button>
    </div>
  </div>
</section>
