<script lang="ts">
  export let data;

  function sanitize(v: string) {
    return v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  }

  const suggested = data.user.twitterHandle ?? (data.user.googleEmail?.split('@')[0] ?? '');
  let handle = sanitize(suggested);
  let error = '';
  let loading = false;

  const HANDLE_RE = /^[a-z0-9_-]{3,30}$/;
  $: valid = HANDLE_RE.test(handle);
  $: preview = handle || 'yourhandle';

  function onInput(e: Event) {
    handle = sanitize((e.currentTarget as HTMLInputElement).value);
    error = '';
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid || loading) return;
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

<div class="flex-1 flex items-center justify-center px-4 pb-24">
<section class="w-full max-w-md">
  <div class="text-center mb-10">
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">
      Claim your handle
    </h1>
  </div>

  <form on:submit={submit} class="space-y-5">
    <div>
      <div class="flex items-stretch rounded-xl overflow-hidden transition-colors"
           style="border: 1px solid {error ? 'var(--error)' : valid ? 'var(--accent)' : 'var(--border)'}; background: var(--surface);">
        <span class="pl-4 pr-2 flex items-center text-base tabular-nums" style="color: var(--text-muted);">iksi.app/@</span>
        <input
          type="text"
          value={handle}
          on:input={onInput}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          required
          minlength="3"
          maxlength="30"
          placeholder="handle"
          class="flex-1 py-4 pr-4 outline-none text-base bg-transparent"
          style="color: var(--text-primary);"
        />
      </div>
      <p class="mt-2 text-xs" style="color: var(--text-muted);">
        3–30 characters. Lowercase letters, numbers, <code style="font-family: inherit;">_</code>, <code style="font-family: inherit;">-</code>.
      </p>
    </div>

    <div class="rounded-xl px-4 py-3 text-sm" style="background: var(--surface); border: 1px dashed var(--border); color: var(--text-muted);">
      Preview: <span style="color: var(--text-primary);">iksi.app/@{preview}</span>
    </div>

    {#if error}
      <p class="text-sm" style="color: var(--error);">{error}</p>
    {/if}

    <button
      type="submit"
      disabled={!valid || loading}
      class="w-full text-base font-medium px-4 py-4 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      style="background: var(--text-primary); color: var(--bg);"
    >
      {loading ? 'Claiming…' : `Claim @${handle || '…'}`}
    </button>
  </form>
</section>
</div>
