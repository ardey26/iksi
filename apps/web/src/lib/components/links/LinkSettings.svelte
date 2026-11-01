<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
  import { toForm, fromForm, type LinkSettingsData, type RuleForm } from '#lib/rules-form.js';
  import RulesEditor from './RulesEditor.svelte';

  export let id: number;
  export let settings: LinkSettingsData;

  const dispatch = createEventDispatcher<{ saved: LinkSettingsData }>();

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

  async function save() {
    if (!dirty || saving) return;
    error = '';
    const body: Record<string, unknown> = { id };

    if (destinationDirty) body.destination = destination.trim();
    if (rulesDirty) {
      const built = fromForm(ruleForms);
      if (!built.ok) { error = built.error; return; }
      body.rules = built.rules;
    }
    if (expiryDirty) {
      if (expiresLocal === '') body.expiresAt = null;
      else {
        const d = new Date(expiresLocal);
        if (Number.isNaN(d.getTime())) { error = 'Enter a valid expiry date'; return; }
        body.expiresAt = d.toISOString();
      }
    }
    if (maxDirty) {
      const t = maxClicks.trim();
      if (t === '') body.maxClicks = null;
      else {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 1) { error = 'Click limit must be a whole number above 0'; return; }
        body.maxClicks = n;
      }
    }
    if (removePassword) body.password = null;
    else if (newPassword !== '') {
      if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
        error = `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`;
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
</script>

<div class="ls d-scope">
  <div class="d-spec d-flush">
    <div class="d-row">
      <label class="d-label" for={`ls-${id}-dest`}>Destination</label>
      <div class="d-control">
        <input id={`ls-${id}-dest`} class="d-field" type="text" inputmode="url" maxlength="2048" aria-describedby={`ls-${id}-dest-hint`} bind:value={destination} />
        <p class="d-hint" id={`ls-${id}-dest-hint`}>https:// is added if missing</p>
      </div>
    </div>

    <div class="d-row">
      <label class="d-label" for={`ls-${id}-expires`}>Expiry</label>
      <div class="d-control">
        <div class="flex items-center gap-3">
          <input id={`ls-${id}-expires`} class="d-field min-w-0 flex-1" type="datetime-local" aria-describedby={`ls-${id}-expires-hint`} bind:value={expiresLocal} />
          <button type="button" class="d-btn d-btn-text" disabled={expiresLocal === ''} on:click={() => (expiresLocal = '')}>Clear</button>
        </div>
        <p class="d-hint" id={`ls-${id}-expires-hint`}>In your time zone. Empty means it never expires.</p>
      </div>
    </div>

    <div class="d-row">
      <label class="d-label" for={`ls-${id}-max`}>Click limit</label>
      <div class="d-control">
        <div class="d-unit-field limit">
          <input id={`ls-${id}-max`} class="d-field" type="text" inputmode="numeric" placeholder="No limit" bind:value={maxClicks} />
          {#if maxClicks.trim()}<span class="d-unit" aria-hidden="true">clicks</span>{/if}
        </div>
      </div>
    </div>

    <div class="d-row">
      <span class="d-label">Password</span>
      <div class="d-control">
        {#if current.hasPassword && removePassword}
          <div class="d-inline">
            <span class="state"><span class="d-dot" aria-hidden="true"></span>Removed on save</span>
            <button type="button" class="d-btn d-btn-text" on:click={() => (removePassword = false)}>Undo</button>
          </div>
        {:else if current.hasPassword && !changePassword}
          <div class="d-inline">
            <span class="state"><span class="d-dot on" aria-hidden="true"></span>Password set</span>
            <span class="flex items-center gap-4">
              <button type="button" class="d-btn d-btn-text" on:click={() => (changePassword = true)}>Change password</button>
              <button type="button" class="d-btn d-btn-text d-btn-danger" on:click={() => { removePassword = true; changePassword = false; newPassword = ''; }}>Remove password</button>
            </span>
          </div>
        {:else}
          <label class="sr-only" for={`ls-${id}-pw`}>New password</label>
          <input id={`ls-${id}-pw`} class="d-field" type="password" autocomplete="new-password" maxlength={PASSWORD_MAX} placeholder={current.hasPassword ? 'New password' : 'Not set'} aria-describedby={`ls-${id}-pw-hint`} bind:value={newPassword} />
          <p class="d-hint" id={`ls-${id}-pw-hint`}>{PASSWORD_MIN} to {PASSWORD_MAX} characters. Visitors enter it before they are redirected.</p>
        {/if}
      </div>
    </div>

    <div class="d-row">
      <span class="d-label">Permanent redirect</span>
      <div class="d-control">
        <div class="d-inline">
          <button
            type="button"
            role="switch"
            class="d-switch"
            aria-checked={permanent}
            aria-label="Permanent redirect"
            aria-describedby={`ls-${id}-perm-hint`}
            on:click={() => (permanent = !permanent)}
          ></button>
          <span class="d-readout code">{permanent ? '301' : '302'}</span>
        </div>
        <p class="d-hint" id={`ls-${id}-perm-hint`}>Browsers cache 301s. Only use this if the destination will never change.</p>
      </div>
    </div>
  </div>

  <section class="rules" aria-labelledby={`ls-${id}-rules-title`}>
    <div class="d-section-head">
      <h3 class="d-title" id={`ls-${id}-rules-title`}>Routing rules</h3>
      <span class="d-readout count">{rulesSummary}</span>
    </div>
    <p class="d-desc">The first rule that matches wins. Everyone else goes to the destination.</p>
    <RulesEditor bind:rules={ruleForms} />
  </section>

  <div class="footer ls-footer">
    <p class="err" role="alert">{error}</p>
    <button type="button" class="d-btn d-btn-primary" disabled={!dirty || saving} on:click={save}>{saving ? 'Saving' : 'Save'}</button>
  </div>
</div>

<style>
  .limit {
    width: 168px;
    max-width: 100%;
    --d-unit-pad: 60px;
  }
  .state {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
  }
  .code {
    font-size: 13px;
    color: var(--text-muted);
  }
  .count {
    font-size: 13px;
    color: var(--text-muted);
  }
  .rules {
    margin-top: 48px;
  }
  .footer {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 48px calc(-1 * var(--ls-pad, 0px)) 0;
    padding: 16px var(--ls-pad, 0px);
    background-color: var(--bg);
    border-top: 1px solid var(--border);
  }
  .err {
    min-width: 0;
    min-height: 18px;
    font-size: 13px;
    line-height: 18px;
    color: var(--error);
  }
  .footer .d-btn {
    min-width: 96px;
  }
</style>
