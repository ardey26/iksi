<script lang="ts">
  import { MAX_RULES } from '@iksi/core';
  import type { Continent, Device, Os } from '@iksi/core';
  import { newRuleId, type ConditionForm, type RuleForm } from '#lib/rules-form.js';

  export let rules: RuleForm[] = [];

  const MAX_SPLIT = 5;
  const MIN_SPLIT = 2;

  const KINDS: { kind: ConditionForm['kind']; label: string }[] = [
    { kind: 'country', label: 'Country' },
    { kind: 'continent', label: 'Continent' },
    { kind: 'device', label: 'Device' },
    { kind: 'os', label: 'Operating system' },
    { kind: 'referrer', label: 'Referrer' },
    { kind: 'time', label: 'Time of day' }
  ];
  const CONTINENTS: { value: Continent; label: string }[] = [
    { value: 'AF', label: 'Africa' },
    { value: 'AN', label: 'Antarctica' },
    { value: 'AS', label: 'Asia' },
    { value: 'EU', label: 'Europe' },
    { value: 'NA', label: 'North America' },
    { value: 'OC', label: 'Oceania' },
    { value: 'SA', label: 'South America' }
  ];
  const DEVICES: { value: Device; label: string }[] = [
    { value: 'mobile', label: 'Mobile' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'tablet', label: 'Tablet' }
  ];
  const OSES: { value: Os; label: string }[] = [
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
    { value: 'windows', label: 'Windows' },
    { value: 'macos', label: 'macOS' },
    { value: 'linux', label: 'Linux' },
    { value: 'other', label: 'Other' }
  ];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function browserZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }
  function zoneList(): string[] {
    let zones: string[] = [];
    try {
      zones = (Intl as any).supportedValuesOf('timeZone');
    } catch {
      zones = [];
    }
    const set = new Set(['UTC', browserZone(), ...zones]);
    return [...set];
  }
  const ZONES = zoneList();
  function zonesWith(tz: string): string[] {
    return ZONES.includes(tz) ? ZONES : [tz, ...ZONES];
  }

  function defaultCondition(kind: ConditionForm['kind']): ConditionForm {
    switch (kind) {
      case 'country': return { kind, values: '' };
      case 'referrer': return { kind, values: '' };
      case 'continent': return { kind, values: [] };
      case 'device': return { kind, values: [] };
      case 'os': return { kind, values: [] };
      default: return { kind: 'time', days: [], start: '09:00', end: '17:00', tz: browserZone() };
    }
  }

  function addRule() {
    if (rules.length >= MAX_RULES) return;
    rules = [...rules, { id: newRuleId(), conditions: [], mode: 'single', destination: '', split: [] }];
  }
  function removeRule(i: number) {
    rules = rules.filter((_, idx) => idx !== i);
  }
  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    rules = next;
  }
  function addCondition(rule: RuleForm, e: Event) {
    const select = e.currentTarget as HTMLSelectElement;
    const kind = select.value as ConditionForm['kind'];
    select.value = '';
    if (!kind) return;
    rule.conditions = [...rule.conditions, defaultCondition(kind)];
    rules = rules;
  }
  function removeCondition(rule: RuleForm, ci: number) {
    rule.conditions = rule.conditions.filter((_, idx) => idx !== ci);
    rules = rules;
  }
  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }
  function toggleDay(days: number[], d: number): number[] {
    return toggle(days, d).sort((a, b) => a - b);
  }
  function setMode(rule: RuleForm, mode: 'single' | 'split') {
    if (rule.mode === mode) return;
    rule.mode = mode;
    if (mode === 'split' && rule.split.length < MIN_SPLIT) {
      rule.split = [
        { destination: rule.destination, weight: '50' },
        { destination: '', weight: '50' }
      ];
    }
    rules = rules;
  }
  function addSplit(rule: RuleForm) {
    if (rule.split.length >= MAX_SPLIT) return;
    rule.split = [...rule.split, { destination: '', weight: '' }];
    rules = rules;
  }
  function removeSplit(rule: RuleForm, si: number) {
    if (rule.split.length <= MIN_SPLIT) return;
    rule.split = rule.split.filter((_, idx) => idx !== si);
    rules = rules;
  }
  function total(rule: RuleForm): number {
    return rule.split.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
  }
  function available(rule: RuleForm) {
    const used = new Set(rule.conditions.map((c) => c.kind));
    return KINDS.filter((k) => !used.has(k.kind));
  }
  function kindLabel(kind: string) {
    return KINDS.find((k) => k.kind === kind)?.label ?? kind;
  }
</script>

<div class="space-y-3">
  {#if rules.length === 0}
    <p class="text-sm" style="color: var(--text-muted);">No rules. Everyone goes to the main destination.</p>
  {/if}

  {#each rules as rule, i (rule.id)}
    <fieldset class="rule space-y-3" aria-label={`Rule ${i + 1}`}>
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-muted);">Rule {i + 1}</span>
        <div class="flex items-center gap-1">
          <button type="button" class="icon" aria-label={`Move rule ${i + 1} up`} disabled={i === 0} on:click={() => move(i, -1)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>
          </button>
          <button type="button" class="icon" aria-label={`Move rule ${i + 1} down`} disabled={i === rules.length - 1} on:click={() => move(i, 1)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" class="icon" aria-label={`Remove rule ${i + 1}`} on:click={() => removeRule(i)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>

      <!-- When -->
      <div class="space-y-2">
        <p class="label">When</p>
        {#if rule.conditions.length === 0}
          <p class="hint">Always, unless an earlier rule matched.</p>
        {/if}
        {#each rule.conditions as c, ci (c.kind)}
          <div class="cond space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium" style="color: var(--text-primary);">{kindLabel(c.kind)}</span>
              <button type="button" class="icon" aria-label={`Remove ${kindLabel(c.kind)} condition`} on:click={() => removeCondition(rule, ci)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>

            {#if c.kind === 'country'}
              <label class="sr-only" for={`${rule.id}-country`}>Countries</label>
              <input id={`${rule.id}-country`} class="field" type="text" placeholder="SG, MY, ID" bind:value={c.values} />
              <p class="hint">Two-letter country codes, separated by commas.</p>
            {:else if c.kind === 'referrer'}
              <label class="sr-only" for={`${rule.id}-referrer`}>Referrer hosts</label>
              <input id={`${rule.id}-referrer`} class="field" type="text" placeholder="x.com, news.ycombinator.com" bind:value={c.values} />
              <p class="hint">Also matches subdomains. Separate with commas.</p>
            {:else if c.kind === 'continent'}
              <div class="flex flex-wrap gap-2" role="group" aria-label="Continents">
                {#each CONTINENTS as o}
                  <label class="chip">
                    <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                           on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                    <span>{o.label}</span>
                  </label>
                {/each}
              </div>
            {:else if c.kind === 'device'}
              <div class="flex flex-wrap gap-2" role="group" aria-label="Devices">
                {#each DEVICES as o}
                  <label class="chip">
                    <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                           on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                    <span>{o.label}</span>
                  </label>
                {/each}
              </div>
            {:else if c.kind === 'os'}
              <div class="flex flex-wrap gap-2" role="group" aria-label="Operating systems">
                {#each OSES as o}
                  <label class="chip">
                    <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                           on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                    <span>{o.label}</span>
                  </label>
                {/each}
              </div>
            {:else}
              <div class="flex flex-wrap gap-2" role="group" aria-label="Days">
                {#each DAYS as d, di}
                  <label class="chip">
                    <input type="checkbox" class="sr-only" checked={c.days.includes(di)}
                           on:change={() => { c.days = toggleDay(c.days, di); rules = rules; }} />
                    <span>{d}</span>
                  </label>
                {/each}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="label" for={`${rule.id}-start`}>Start</label>
                  <input id={`${rule.id}-start`} class="field" type="time" bind:value={c.start} />
                </div>
                <div>
                  <label class="label" for={`${rule.id}-end`}>End</label>
                  <input id={`${rule.id}-end`} class="field" type="time" bind:value={c.end} />
                </div>
              </div>
              <div>
                <label class="label" for={`${rule.id}-tz`}>Time zone</label>
                <select id={`${rule.id}-tz`} class="field" bind:value={c.tz}>
                  {#each zonesWith(c.tz) as z}<option value={z}>{z}</option>{/each}
                </select>
              </div>
              <p class="hint">No days selected means every day. Overnight windows count from their start day.</p>
            {/if}
          </div>
        {/each}

        {#if available(rule).length > 0}
          <select class="field add-select" aria-label="Add condition" on:change={(e) => addCondition(rule, e)}>
            <option value="">Add condition</option>
            {#each available(rule) as k}<option value={k.kind}>{k.label}</option>{/each}
          </select>
        {/if}
      </div>

      <!-- Go to -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <p class="label">Go to</p>
          <div class="seg" role="radiogroup" aria-label={`Rule ${i + 1} destination type`}>
            <button type="button" role="radio" aria-checked={rule.mode === 'single'} class:on={rule.mode === 'single'} on:click={() => setMode(rule, 'single')}>One URL</button>
            <button type="button" role="radio" aria-checked={rule.mode === 'split'} class:on={rule.mode === 'split'} on:click={() => setMode(rule, 'split')}>A/B split</button>
          </div>
        </div>

        {#if rule.mode === 'single'}
          <label class="sr-only" for={`${rule.id}-dest`}>Go to</label>
          <input id={`${rule.id}-dest`} class="field" type="text" inputmode="url" placeholder="https://example.com" bind:value={rule.destination} />
        {:else}
          {#each rule.split as s, si}
            <div class="flex items-center gap-2">
              <input class="field flex-1 min-w-0" type="text" inputmode="url" placeholder="https://example.com" aria-label={`Split destination ${si + 1}`} bind:value={s.destination} />
              <input class="field weight" type="text" inputmode="numeric" placeholder="%" aria-label={`Split weight ${si + 1}`} bind:value={s.weight} />
              <button type="button" class="icon" aria-label={`Remove split row ${si + 1}`} disabled={rule.split.length <= MIN_SPLIT} on:click={() => removeSplit(rule, si)}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
          {/each}
          <div class="flex items-center justify-between gap-2">
            <button type="button" class="ghost" disabled={rule.split.length >= MAX_SPLIT} on:click={() => addSplit(rule)}>Add split row</button>
            <p class="text-xs tabular-nums" aria-live="polite" style="color: {total(rule) === 100 ? 'var(--accent)' : 'var(--error)'};">
              {total(rule)} of 100{total(rule) === 100 ? '' : ', must add up to 100'}
            </p>
          </div>
        {/if}
      </div>
    </fieldset>
  {/each}

  <div class="flex items-center justify-between gap-2">
    <button type="button" class="ghost" disabled={rules.length >= MAX_RULES} on:click={addRule}>Add rule</button>
    <span class="text-xs tabular-nums" style="color: var(--text-muted);">{rules.length} of {MAX_RULES}</span>
  </div>
</div>

<style>
  .rule {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    min-width: 0;
  }
  .cond {
    border-radius: 8px;
    padding: 0.5rem 0.625rem;
    background: color-mix(in srgb, var(--text-primary) 3%, transparent);
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
  .weight {
    width: 4rem;
    flex: none;
    text-align: right;
  }
  .add-select {
    width: auto;
    max-width: 100%;
  }
  .chip {
    display: inline-flex;
    cursor: pointer;
  }
  .chip span {
    font-size: 0.8125rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    color: var(--text-muted);
    border: 1px solid var(--border);
    background: var(--bg);
    transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chip input:checked + span {
    color: var(--text-primary);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .chip input:focus-visible + span {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }
  .icon {
    display: inline-flex;
    padding: 0.375rem;
    border-radius: 6px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
  }
  .icon:hover:not(:disabled) {
    color: var(--text-primary);
  }
  .icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .ghost {
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
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
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .seg button {
    font-size: 0.75rem;
    padding: 0.25rem 0.625rem;
    background: transparent;
    color: var(--text-muted);
    border: none;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--text-primary);
    color: var(--bg);
  }
  .icon:focus-visible,
  .ghost:focus-visible,
  .seg button:focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }
</style>
