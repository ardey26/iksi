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

<div class="flex-1 flex items-center justify-center px-4 pb-24 d-scope">
<section class="w-full max-w-md">
  <div class="text-center mb-10">
    <h1 class="text-3xl font-semibold tracking-tight" style="color: var(--text-primary);">
      Claim your handle
    </h1>
  </div>

  <form on:submit={submit}>
    <label class="label" for="claim-handle">Handle</label>
    <div class="group" class:valid={valid && !error} class:invalid={!!error}>
      <span class="prefix">iksi.app/@</span>
      <input
        id="claim-handle"
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
        aria-describedby="claim-hint"
        aria-invalid={!!error}
      />
    </div>
    <p class="d-hint" id="claim-hint">
      3 to 30 characters. Lowercase letters, numbers, <code style="font-family: inherit;">_</code> and <code style="font-family: inherit;">-</code>.
    </p>

    <div class="preview">
      <span class="preview-label">Your page</span>
      <span class="preview-value">iksi.app/@{preview}</span>
    </div>

    <p class="err" role={error ? 'alert' : undefined}>{error}</p>

    <button type="submit" disabled={!valid || loading} class="d-btn d-btn-primary w-full">
      {loading ? 'Claiming…' : `Claim @${handle || '…'}`}
    </button>
  </form>
</section>
</div>

<style>
  .label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .group {
    display: flex;
    align-items: stretch;
    height: var(--d-ctl);
    overflow: hidden;
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--d-radius);
    transition: border-color var(--duration-normal) var(--ease-out);
  }
  .group.valid { border-color: var(--accent); }
  .group.invalid { border-color: var(--error); }
  .group:focus-within {
    outline: 1px solid var(--border-focus);
    outline-offset: 0;
  }
  .prefix {
    display: flex;
    align-items: center;
    padding: 0 2px 0 12px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .group input {
    flex: 1;
    min-width: 0;
    padding: 0 12px 0 0;
    font-size: 14px;
    color: var(--text-primary);
    background-color: transparent;
    border: none;
    outline: none;
  }
  .preview {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-top: 24px;
    padding: 16px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .preview-label {
    font-size: 13px;
    color: var(--text-muted);
  }
  .preview-value {
    min-width: 0;
    overflow: hidden;
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--text-primary);
  }
  .err {
    min-height: 18px;
    margin: 12px 0;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
</style>
