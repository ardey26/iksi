<script lang="ts">
  // The link settings sheet: everything about one short link, saved together
  // by its footer. The settings go to PATCH /dashboard/links; the page title
  // (when `pageTitle` is given) is handed back to the page, which owns the
  // profile row.
  import { createEventDispatcher, tick } from 'svelte';
  import { Badge, Button, Field, IconButton, Input, Segmented, Sheet, Stack } from '#lib/ui/index.js';
  import { PASSWORD_MIN, PASSWORD_MAX } from '#lib/password-limits.js';
  import { toForm, fromForm, type LinkSettingsData, type RuleForm } from '#lib/rules-form.js';
  import RulesEditor from './RulesEditor.svelte';

  export let id: number;
  export let settings: LinkSettingsData;
  export let open = false;
  /** The short link as shown, e.g. "iksi.app/sale". */
  export let short = '';
  /** The link's title on the public page. Leave undefined to hide the field. */
  export let pageTitle: string | undefined = undefined;
  /** Offer "Delete link" at the end of the sheet. */
  export let deletable = false;

  const dispatch = createEventDispatcher<{ saved: LinkSettingsData; title: string; delete: void; close: void }>();

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
  let reveal = false;
  let redirect: '302' | '301' = '302';
  let baseRules = '';
  let title = '';
  let baseTitle = '';
  let confirmDelete = false;
  let current: LinkSettingsData = settings;
  let lastSettings = settings;

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
    reveal = false;
    redirect = s.permanent ? '301' : '302';
    title = baseTitle = pageTitle ?? '';
    confirmDelete = false;
    error = '';
    errors = {};
  }

  // A new link (or the page's copy of a saved one) replaces the baseline.
  $: if (settings !== lastSettings) {
    lastSettings = settings;
    current = settings;
    if (!open) load(settings);
  }
  // Each opening starts from what is saved: Cancel and close discard edits.
  let wasOpen = false;
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) load(current);
  }

  $: permanent = redirect === '301';
  $: rulesDirty = JSON.stringify(ruleForms) !== baseRules;
  $: destinationDirty = destination !== current.destination;
  $: expiryDirty = expiresLocal !== toLocalInput(current.expiresAt);
  $: maxDirty = maxClicks.trim() !== (current.maxClicks === null ? '' : String(current.maxClicks));
  $: passwordDirty = removePassword || newPassword !== '';
  $: permanentDirty = permanent !== current.permanent;
  $: settingsDirty = rulesDirty || destinationDirty || expiryDirty || maxDirty || passwordDirty || permanentDirty;
  $: titleDirty = pageTitle !== undefined && title.trim() !== baseTitle.trim();
  $: dirty = settingsDirty || titleDirty;

  let saving = false;
  let error = '';
  let errors: { expiry?: string; limit?: string; password?: string } = {};

  function close() {
    open = false;
    dispatch('close');
  }

  async function save() {
    if (!dirty || saving) return;
    error = '';
    errors = {};
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
        if (Number.isNaN(d.getTime())) { errors = { expiry: 'Enter a valid expiry date' }; return; }
        body.expiresAt = d.toISOString();
      }
    }
    if (maxDirty) {
      const t = maxClicks.trim();
      if (t === '') body.maxClicks = null;
      else {
        const n = Number(t);
        if (!Number.isInteger(n) || n < 1) { errors = { limit: 'Click limit must be a whole number above 0' }; return; }
        body.maxClicks = n;
      }
    }
    if (removePassword) body.password = null;
    else if (newPassword !== '') {
      if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
        errors = { password: `Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters` };
        return;
      }
      body.password = newPassword;
    }
    if (permanentDirty) body.permanent = permanent;

    const wantsTitle = titleDirty ? title : null;
    if (settingsDirty) {
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
        return;
      } finally {
        saving = false;
      }
    }
    if (wantsTitle !== null) dispatch('title', wantsTitle);
    close();
  }

  async function askDelete() {
    confirmDelete = true;
    await tick();
    document.querySelector<HTMLElement>('[data-act="delete-cancel"]')?.focus();
  }
  async function keepLink() {
    confirmDelete = false;
    await tick();
    document.querySelector<HTMLElement>('[data-act="delete"]')?.focus();
  }

  $: rulesSummary = ruleForms.length === 0 ? 'None' : `${ruleForms.length} ${ruleForms.length === 1 ? 'rule' : 'rules'}`;
</script>

<Sheet bind:open title="Link settings" description={short} width={480} on:close>
  <div class="ls" data-link={id}>
    <Stack gap={24}>
      {#if pageTitle !== undefined}
        <Input
          label="Title on your page"
          bind:value={title}
          maxlength="80"
          placeholder="Untitled"
          hint="Shown on your public page. Clear it to take the link off your page."
        />
      {/if}

      <Input
        label="Destination"
        icon="link"
        inputmode="url"
        maxlength="2048"
        hint="https:// is added if missing"
        bind:value={destination}
      />

      <Field label="Redirect" group hint="Browsers cache permanent redirects. Use it only if the destination will never change." let:labelId>
        <Segmented
          full
          labelledby={labelId}
          bind:value={redirect}
          options={[
            { value: '302', label: 'Temporary' },
            { value: '301', label: 'Permanent' }
          ]}
        />
      </Field>

      <div class="pair">
        <Input
          label="Expiry"
          type="datetime-local"
          hint="In your time zone. Empty never expires."
          error={errors.expiry}
          bind:value={expiresLocal}
        >
          <svelte:fragment slot="aside">
            {#if expiresLocal}<Button size="sm" variant="ghost" on:click={() => (expiresLocal = '')}>Clear</Button>{/if}
          </svelte:fragment>
        </Input>
        <Input
          label="Click limit"
          inputmode="numeric"
          placeholder="No limit"
          align="end"
          unit={maxClicks.trim() ? 'clicks' : ''}
          error={errors.limit}
          bind:value={maxClicks}
        />
      </div>

      {#if current.hasPassword && !changePassword}
        <Field label="Password" group reserve={false}>
          <div class="state">
            {#if removePassword}
              <Badge variant="warning">Removed on save</Badge>
              <Button size="sm" variant="ghost" on:click={() => (removePassword = false)}>Undo</Button>
            {:else}
              <Badge variant="success" dot>Password set</Badge>
              <span class="actions">
                <Button size="sm" variant="ghost" on:click={() => (changePassword = true)}>Change password</Button>
                <Button size="sm" variant="danger" on:click={() => { removePassword = true; newPassword = ''; }}>Remove password</Button>
              </span>
            {/if}
          </div>
        </Field>
      {:else}
        <Input
          label={current.hasPassword ? 'New password' : 'Password'}
          optional={!current.hasPassword}
          type={reveal ? 'text' : 'password'}
          autocomplete="new-password"
          maxlength={PASSWORD_MAX}
          placeholder="At least {PASSWORD_MIN} characters"
          hint="Visitors enter it before they are redirected."
          error={errors.password}
          bind:value={newPassword}
        >
          <IconButton
            slot="end"
            icon={reveal ? 'eye-off' : 'eye'}
            label={reveal ? 'Hide password' : 'Show password'}
            on:click={() => (reveal = !reveal)}
          />
        </Input>
      {/if}

      <section class="rules" aria-labelledby={`ls-${id}-rules`}>
        <div class="rules-head">
          <h3 class="heading" id={`ls-${id}-rules`}>Routing rules</h3>
          <span class="t-label t-muted t-tabular">{rulesSummary}</span>
        </div>
        <p class="t-label t-muted desc">The first rule that matches wins. Everyone else goes to the destination.</p>
        <RulesEditor bind:rules={ruleForms} />
      </section>

      {#if deletable}
        <section class="danger" aria-label="Delete link">
          {#if confirmDelete}
            <p class="t-label">Delete {short}? Its clicks and settings go with it.</p>
            <span class="actions">
              <Button size="sm" variant="ghost" data-act="delete-cancel" on:click={keepLink}>Cancel</Button>
              <Button size="sm" variant="danger" icon="trash" on:click={() => dispatch('delete')}>Delete</Button>
            </span>
          {:else}
            <Button size="sm" variant="danger" icon="trash" data-act="delete" on:click={askDelete}>Delete link</Button>
          {/if}
        </section>
      {/if}
    </Stack>
  </div>

  <svelte:fragment slot="footer">
    {#if error}<p class="error t-label" role="alert">{error}</p>{/if}
    <Button on:click={close}>Cancel</Button>
    <Button variant="primary" loading={saving} disabled={!dirty} on:click={save}>Save</Button>
  </svelte:fragment>
</Sheet>

<style>
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 160px;
    gap: 12px;
  }
  .state {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    min-height: 40px;
  }
  .actions {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .rules {
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  .rules-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .heading {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .desc { margin: 4px 0 16px; }
  .danger {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  .danger p { margin: 0; color: var(--text-primary); }
  .danger > :global(button:only-child) { margin-left: -12px; }
  .error {
    margin: 0;
    color: var(--error);
  }
  @media (min-width: 768px) {
    .error { margin-right: auto; align-self: center; }
  }
  @media (max-width: 479px) {
    .pair { grid-template-columns: minmax(0, 1fr); }
  }
</style>
