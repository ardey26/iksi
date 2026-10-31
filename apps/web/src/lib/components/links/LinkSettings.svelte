<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
  import { toForm, fromForm, type LinkSettingsData, type RuleForm } from '#lib/rules-form.js';
  import RulesEditor from './RulesEditor.svelte';

  export let id: number;
  export let settings: LinkSettingsData;

  const dispatch = createEventDispatcher<{ saved: LinkSettingsData }>();

  type Section = 'destination' | 'rules' | 'expiry' | 'password' | 'permanent';
  let open: Record<Section, boolean> = { destination: false, rules: false, expiry: false, password: false, permanent: false };

  function pad(n: number) { return String(n).padStart(2, '0'); }
  // The date-time input works in the browser's zone; the server stores UTC.
  function toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  let destination = '';
  let ruleForms: RuleForm[] = [];
  let expiresLocal = '';
  let maxClicks = '';
  let removePassword = false;
  let changePassword = false;
  let newPassword = '';
  let permanent = false;
  let baseRules = '';
  let current: LinkSettingsData = settings;

  function load(s: LinkSettingsData) {
    current = s;
    destination = s.destination;
    ruleForms = toForm(s.rules);
    baseRules = JSON.stringify(ruleForms);
    expiresLocal = toLocalInput(s.expiresAt);
    maxClicks = s.maxClicks === null ? '' : String(s.maxClicks);
    removePassword = false;
    changePassword = false;
    newPassword = '';
    permanent = s.permanent;
  }
  load(settings);

  $: rulesDirty = JSON.stringify(ruleForms) !== baseRules;
  $: destinationDirty = destination !== current.destination;
  $: expiryDirty = expiresLocal !== toLocalInput(current.expiresAt);
  $: maxDirty = maxClicks.trim() !== (current.maxClicks === null ? '' : String(current.maxClicks));
  $: passwordDirty = removePassword || newPassword !== '';
  $: permanentDirty = permanent !== current.permanent;
  $: dirty = rulesDirty || destinationDirty || expiryDirty || maxDirty || passwordDirty || permanentDirty;

  let saving = false;
  let error = '';

  function toggle(s: Section) { open[s] = !open[s]; }

  async function save() {
    if (!dirty || saving) return;
    error = '';
    const body: Record<string, unknown> = { id };

    if (destinationDirty) body.destination = destination.trim();
    if (rulesDirty) {
      const built = fromForm(ruleForms);
      if (!built.ok) { error = built.error; open.rules = true; return; }
      body.rules = built.rules;
    }
    if (expiryDirty) {
      if (expiresLocal === '') body.expiresAt = null;
      else {
        const d = new Date(expiresLocal);
        if (Number.isNaN(d.getTime())) { error = 'Enter a valid expiry date'; open.expiry = true; return; }
        body.expiresAt = d.toISOString();
      }
    }
    if (maxDirty) {
      const t = maxClicks.trim();
      if (t === '') body.maxClicks = null;
      else {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 1) { error = 'Max clicks must be a whole number above 0'; open.expiry = true; return; }
        body.maxClicks = n;
      }
    }
    if (removePassword) body.password = null;
    else if (newPassword !== '') {
      if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
        error = `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`;
        open.password = true;
        return;
      }
      body.password = newPassword;
    }
    if (permanentDirty) body.permanent = permanent;

    saving = true;
    try {
      const res = await fetch('/dashboard/links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        error = out.error || 'Could not save settings';
        return;
      }
      load(out.settings);
      dispatch('saved', out.settings);
    } catch {
      error = 'Network error';
    } finally {
      saving = false;
    }
  }

  $: rulesSummary = ruleForms.length === 0 ? 'None' : `${ruleForms.length} ${ruleForms.length === 1 ? 'rule' : 'rules'}`;
  $: expirySummary = expiresLocal || maxClicks.trim() ? [expiresLocal && 'Date set', maxClicks.trim() && `${maxClicks.trim()} clicks`].filter(Boolean).join(', ') : 'None';
  $: passwordSummary = removePassword ? 'Will be removed' : newPassword ? 'Will be changed' : current.hasPassword ? 'Set' : 'None';
</script>

<div class="panel">
  <!-- Destination -->
  <div class="section">
    <button type="button" class="head" aria-expanded={open.destination} aria-controls={`ls-${id}-destination`} on:click={() => toggle('destination')}>
      <span>Destination</span>
      <span class="sum">{open.destination ? '' : destination}</span>
    </button>
    {#if open.destination}
      <div class="body" id={`ls-${id}-destination`}>
        <label class="label" for={`ls-${id}-dest-input`}>Destination</label>
        <input id={`ls-${id}-dest-input`} class="field" type="text" inputmode="url" maxlength="2048" bind:value={destination} />
      </div>
    {/if}
  </div>

  <!-- Routing rules -->
  <div class="section">
    <button type="button" class="head" aria-expanded={open.rules} aria-controls={`ls-${id}-rules`} on:click={() => toggle('rules')}>
      <span>Routing rules</span>
      <span class="sum">{rulesSummary}</span>
    </button>
    {#if open.rules}
      <div class="body" id={`ls-${id}-rules`}>
        <p class="hint mb-3">The first rule that matches wins. Otherwise visitors go to the destination above.</p>
        <RulesEditor bind:rules={ruleForms} />
      </div>
    {/if}
  </div>

  <!-- Expiry -->
  <div class="section">
    <button type="button" class="head" aria-expanded={open.expiry} aria-controls={`ls-${id}-expiry`} on:click={() => toggle('expiry')}>
      <span>Expiry</span>
      <span class="sum">{expirySummary}</span>
    </button>
    {#if open.expiry}
      <div class="body space-y-3" id={`ls-${id}-expiry`}>
        <div>
          <label class="label" for={`ls-${id}-expires`}>Expires on</label>
          <div class="flex items-center gap-2">
            <input id={`ls-${id}-expires`} class="field" type="datetime-local" bind:value={expiresLocal} />
            <button type="button" class="ghost" disabled={expiresLocal === ''} on:click={() => (expiresLocal = '')}>Clear</button>
          </div>
          <p class="hint mt-1">In your time zone.</p>
        </div>
        <div>
          <label class="label" for={`ls-${id}-max`}>Max clicks</label>
          <input id={`ls-${id}-max`} class="field" type="text" inputmode="numeric" placeholder="No limit" bind:value={maxClicks} />
        </div>
      </div>
    {/if}
  </div>

  <!-- Password -->
  <div class="section">
    <button type="button" class="head" aria-expanded={open.password} aria-controls={`ls-${id}-password`} on:click={() => toggle('password')}>
      <span>Password</span>
      <span class="sum">{passwordSummary}</span>
    </button>
    {#if open.password}
      <div class="body space-y-3" id={`ls-${id}-password`}>
        {#if current.hasPassword}
          {#if removePassword}
            <p class="text-sm" style="color: var(--text-primary);">Password will be removed on save.</p>
            <button type="button" class="ghost" on:click={() => (removePassword = false)}>Undo</button>
          {:else}
            <p class="text-sm" style="color: var(--text-primary);">Password set</p>
            {#if !changePassword}
              <div class="flex gap-2">
                <button type="button" class="ghost" on:click={() => (changePassword = true)}>Change password</button>
                <button type="button" class="ghost" on:click={() => { removePassword = true; changePassword = false; newPassword = ''; }}>Remove password</button>
              </div>
            {/if}
          {/if}
        {/if}
        {#if !current.hasPassword || (changePassword && !removePassword)}
          <div>
            <label class="label" for={`ls-${id}-pw`}>New password</label>
            <input id={`ls-${id}-pw`} class="field" type="password" autocomplete="new-password" maxlength={PASSWORD_MAX} bind:value={newPassword} />
            <p class="hint mt-1">{PASSWORD_MIN} to {PASSWORD_MAX} characters. Visitors enter it before they are redirected.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Permanent redirect -->
  <div class="section">
    <button type="button" class="head" aria-expanded={open.permanent} aria-controls={`ls-${id}-permanent`} on:click={() => toggle('permanent')}>
      <span>Permanent redirect</span>
      <span class="sum">{permanent ? 'On' : 'Off'}</span>
    </button>
    {#if open.permanent}
      <div class="body flex items-start gap-3" id={`ls-${id}-permanent`}>
        <button
          type="button"
          role="switch"
          aria-checked={permanent}
          aria-label="Permanent redirect"
          on:click={() => (permanent = !permanent)}
          class="relative inline-flex items-center h-5 w-9 rounded-full shrink-0 mt-0.5 transition-colors"
          style="background: {permanent ? 'var(--accent)' : 'var(--border)'}; border: none; cursor: pointer; padding: 0;"
        >
          <span class="inline-block w-4 h-4 rounded-full transition-transform" style="background: white; transform: translateX({permanent ? '18px' : '2px'});"></span>
        </button>
        <p class="hint">Browsers cache 301s. Only use this if the destination will never change.</p>
      </div>
    {/if}
  </div>

  <div class="footer">
    <p class="err" role="alert">{error}</p>
    <button type="button" class="save" disabled={!dirty || saving} on:click={save}>{saving ? 'Saving' : 'Save'}</button>
  </div>
</div>

<style>
  .panel {
    padding: 0.5rem 1rem 1rem;
    background: color-mix(in srgb, var(--text-primary) 2%, transparent);
  }
  .section {
    border-bottom: 1px solid var(--border);
  }
  .head {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
  }
  .head:focus-visible,
  .ghost:focus-visible,
  .save:focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }
  .sum {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--text-muted);
  }
  .body {
    padding-bottom: 1rem;
  }
  .label {
    display: block;
    font-size: 0.75rem;
    margin-bottom: 0.25rem;
    color: var(--text-muted);
  }
  .hint {
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .field {
    display: block;
    width: 100%;
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    color: var(--text-primary);
    background: var(--bg);
    border: 1px solid var(--border);
    transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .field:focus {
    outline: none;
    border-color: var(--border-focus);
  }
  .field::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }
  .ghost {
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    white-space: nowrap;
    background: transparent;
    color: var(--text-primary);
    border: 1px solid var(--border);
    cursor: pointer;
  }
  .ghost:hover:not(:disabled) {
    border-color: var(--text-muted);
  }
  .ghost:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.75rem;
  }
  .err {
    min-height: 1.25rem;
    font-size: 0.875rem;
    color: var(--error);
  }
  .save {
    flex: none;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 8px;
    background: var(--text-primary);
    color: var(--bg);
    border: none;
    cursor: pointer;
    transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .save:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
