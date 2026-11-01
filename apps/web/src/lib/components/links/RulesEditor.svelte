<script lang="ts">
  import { tick } from 'svelte';
  import { MAX_RULES } from '@iksi/core';
  import type { Continent, Device, Os } from '@iksi/core';
  import { newRuleId, type ConditionForm, type RuleForm } from '#lib/rules-form.js';

  export let rules: RuleForm[] = [];

  let root: HTMLElement;

  /** Moves focus once the DOM reflects a structural change; the first selector that finds an enabled control wins. */
  async function focusAfter(...selectors: string[]) {
    await tick();
    for (const sel of selectors) {
      const el = root?.querySelector<HTMLElement>(sel);
      if (el && !(el as HTMLButtonElement).disabled) { el.focus(); return; }
    }
  }
  const ruleSel = (id: string, act: string) => `[data-rule="${id}"] [data-act="${act}"]`;

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
    const next = rules[i + 1]?.id;
    rules = rules.filter((_, idx) => idx !== i);
    focusAfter(...(next ? [ruleSel(next, 'remove')] : []), '[data-act="add-rule"]');
  }
  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    rules = next;
    focusAfter(ruleSel(next[j].id, by === -1 ? 'up' : 'down'), ruleSel(next[j].id, by === -1 ? 'down' : 'up'));
  }
  // Condition picker: "Add condition" is a quiet text button that reveals
  // the kinds still available for that rule. One picker open at a time.
  let pickerFor: string | null = null;
  function togglePicker(rule: RuleForm) {
    pickerFor = pickerFor === rule.id ? null : rule.id;
    if (pickerFor) focusAfter(`[data-rule="${rule.id}"] [data-kind]`);
  }
  function closePicker(rule: RuleForm) {
    pickerFor = null;
    focusAfter(`[data-rule="${rule.id}"] [data-act="add-condition"]`);
  }
  function onPickerKey(e: KeyboardEvent, rule: RuleForm) {
    if (e.key !== 'Escape') return;
    // Keep Escape from also closing a surrounding dialog.
    e.stopPropagation();
    closePicker(rule);
  }
  function addCondition(rule: RuleForm, kind: ConditionForm['kind']) {
    pickerFor = null;
    rule.conditions = [...rule.conditions, defaultCondition(kind)];
    rules = rules;
    focusAfter(`[data-cond="${rule.id}-${kind}"] input, [data-cond="${rule.id}-${kind}"] select`);
  }
  function removeCondition(rule: RuleForm, ci: number) {
    rule.conditions = rule.conditions.filter((_, idx) => idx !== ci);
    rules = rules;
    focusAfter(`[data-rule="${rule.id}"] [data-act="add-condition"]`, ruleSel(rule.id, 'up'));
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
    focusAfter(`[data-rule="${rule.id}"] [data-split="${Math.min(si, rule.split.length - 1)}"]`, `[data-rule="${rule.id}"] [data-act="add-split"]`);
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
  /** Empty cells that complete the last row of a key grid. */
  function fillers(count: number, cols: number): number[] {
    return Array.from({ length: (cols - (count % cols)) % cols }, (_, i) => i);
  }
</script>

<div class="editor" bind:this={root}>
  {#if rules.length === 0}
    <p class="empty">No rules yet. Everyone goes to the destination.</p>
  {:else}
    <ol class="list">
      {#each rules as rule, i (rule.id)}
        <li class="rule">
          <span class="num" aria-hidden="true">{i + 1}</span>
          <fieldset class="body" aria-label={`Rule ${i + 1}`} data-rule={rule.id}>
            <div class="head">
              <span class="head-label">When</span>
              <div class="tools">
                <button type="button" class="d-icon" data-act="up" aria-label={`Move rule ${i + 1} up`} disabled={i === 0} on:click={() => move(i, -1)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>
                </button>
                <button type="button" class="d-icon" data-act="down" aria-label={`Move rule ${i + 1} down`} disabled={i === rules.length - 1} on:click={() => move(i, 1)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
                </button>
                <button type="button" class="d-icon danger" data-act="remove" aria-label={`Remove rule ${i + 1}`} on:click={() => removeRule(i)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            </div>

            {#if rule.conditions.length === 0}
              <p class="always">Always, unless an earlier rule matched.</p>
            {/if}

            {#each rule.conditions as c, ci (c.kind)}
              <div class="row" data-cond={`${rule.id}-${c.kind}`}>
                <span class="name">{kindLabel(c.kind)}</span>
                <div class="values">
                  {#if c.kind === 'country'}
                    <label class="sr-only" for={`${rule.id}-country`}>Countries</label>
                    <input id={`${rule.id}-country`} class="d-field" type="text" placeholder="SG, MY, ID" bind:value={c.values} />
                    <p class="d-hint">Two-letter codes, separated by commas.</p>
                  {:else if c.kind === 'referrer'}
                    <label class="sr-only" for={`${rule.id}-referrer`}>Referrer hosts</label>
                    <input id={`${rule.id}-referrer`} class="d-field" type="text" placeholder="x.com, news.ycombinator.com" bind:value={c.values} />
                    <p class="d-hint">Subdomains match too. Separate with commas.</p>
                  {:else if c.kind === 'continent'}
                    <div class="d-keys" style="--cols: 2;" role="group" aria-label="Continents">
                      {#each CONTINENTS as o}
                        <label class="d-key">
                          <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                                 on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                          <span>{o.label}</span>
                        </label>
                      {/each}
                      {#each fillers(CONTINENTS.length, 2) as _}<span class="d-key-fill" aria-hidden="true"></span>{/each}
                    </div>
                  {:else if c.kind === 'device'}
                    <div class="d-keys" style="--cols: 3;" role="group" aria-label="Devices">
                      {#each DEVICES as o}
                        <label class="d-key">
                          <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                                 on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                          <span>{o.label}</span>
                        </label>
                      {/each}
                    </div>
                  {:else if c.kind === 'os'}
                    <div class="d-keys" style="--cols: 3;" role="group" aria-label="Operating systems">
                      {#each OSES as o}
                        <label class="d-key">
                          <input type="checkbox" class="sr-only" checked={c.values.includes(o.value)}
                                 on:change={() => { c.values = toggle(c.values, o.value); rules = rules; }} />
                          <span>{o.label}</span>
                        </label>
                      {/each}
                      {#each fillers(OSES.length, 3) as _}<span class="d-key-fill" aria-hidden="true"></span>{/each}
                    </div>
                  {:else}
                    <div class="d-keys days" style="--cols: 7;" role="group" aria-label="Days">
                      {#each DAYS as d, di}
                        <label class="d-key">
                          <input type="checkbox" class="sr-only" checked={c.days.includes(di)}
                                 on:change={() => { c.days = toggleDay(c.days, di); rules = rules; }} />
                          <span>{d}</span>
                        </label>
                      {/each}
                    </div>
                    <div class="range">
                      <label class="sr-only" for={`${rule.id}-start`}>Start</label>
                      <input id={`${rule.id}-start`} class="d-field" type="time" bind:value={c.start} />
                      <span class="to" aria-hidden="true">to</span>
                      <label class="sr-only" for={`${rule.id}-end`}>End</label>
                      <input id={`${rule.id}-end`} class="d-field" type="time" bind:value={c.end} />
                    </div>
                    <label class="sr-only" for={`${rule.id}-tz`}>Time zone</label>
                    <select id={`${rule.id}-tz`} class="d-field tz" bind:value={c.tz}>
                      {#each zonesWith(c.tz) as z}<option value={z}>{z}</option>{/each}
                    </select>
                    <p class="d-hint">No days means every day. Overnight windows count from their start day.</p>
                  {/if}
                </div>
                <button type="button" class="d-icon remove" aria-label={`Remove ${kindLabel(c.kind)} condition`} on:click={() => removeCondition(rule, ci)}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            {/each}

            {#if available(rule).length > 0}
              <div class="add">
                <button type="button" class="d-btn d-btn-text" data-act="add-condition"
                        aria-expanded={pickerFor === rule.id} aria-controls={`${rule.id}-picker`}
                        on:click={() => togglePicker(rule)}>Add condition</button>
                {#if pickerFor === rule.id}
                  <!-- Escape closes the picker; the keys inside are the interactive parts. -->
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <div class="picker" id={`${rule.id}-picker`} role="group" aria-label="Condition type" on:keydown={(e) => onPickerKey(e, rule)}>
                    {#each available(rule) as k}
                      <button type="button" class="d-btn d-btn-secondary pick" data-kind={k.kind} on:click={() => addCondition(rule, k.kind)}>{k.label}</button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="row goto">
              <span class="name">Go to</span>
              <div class="values">
                <div class="d-seg" role="radiogroup" aria-label={`Rule ${i + 1} destination type`}>
                  <label class="d-key">
                    <input type="radio" class="sr-only" name={`${rule.id}-mode`} value="single" checked={rule.mode === 'single'} on:change={() => setMode(rule, 'single')} />
                    <span>One URL</span>
                  </label>
                  <label class="d-key">
                    <input type="radio" class="sr-only" name={`${rule.id}-mode`} value="split" checked={rule.mode === 'split'} on:change={() => setMode(rule, 'split')} />
                    <span>A/B split</span>
                  </label>
                </div>

                {#if rule.mode === 'single'}
                  <label class="sr-only" for={`${rule.id}-dest`}>Go to</label>
                  <input id={`${rule.id}-dest`} class="d-field" type="text" inputmode="url" placeholder="https://example.com" bind:value={rule.destination} />
                {:else}
                  {#each rule.split as s, si}
                    <div class="split">
                      <input class="d-field url" type="text" inputmode="url" placeholder="https://example.com" data-split={si} aria-label={`Split destination ${si + 1}`} bind:value={s.destination} />
                      <div class="d-unit-field weight">
                        <input class="d-field" type="text" inputmode="numeric" placeholder="0" aria-label={`Split weight ${si + 1}`} bind:value={s.weight} />
                        <span class="d-unit" aria-hidden="true">%</span>
                      </div>
                      <button type="button" class="d-icon" aria-label={`Remove split row ${si + 1}`} disabled={rule.split.length <= MIN_SPLIT} on:click={() => removeSplit(rule, si)}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>
                      </button>
                    </div>
                  {/each}
                  <div class="split-foot">
                    <button type="button" class="d-btn d-btn-text" data-act="add-split" disabled={rule.split.length >= MAX_SPLIT} on:click={() => addSplit(rule)}>Add split row</button>
                    <p class="total" class:ok={total(rule) === 100} aria-live="polite">
                      {total(rule)} of 100{total(rule) === 100 ? '' : ', must add up to 100'}
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          </fieldset>
        </li>
      {/each}
    </ol>
  {/if}

  <div class="foot">
    <button type="button" class="d-btn d-btn-secondary" data-act="add-rule" disabled={rules.length >= MAX_RULES} on:click={addRule}>Add rule</button>
    <span class="d-readout cap">{rules.length} of {MAX_RULES}</span>
  </div>
</div>

<style>
  .editor {
    margin-top: 16px;
  }
  .empty {
    padding: 20px 0;
    font-size: 14px;
    color: var(--text-muted);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-bottom: 1px solid var(--border);
  }
  .rule {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    padding: 16px 0 20px;
    border-top: 1px solid var(--border);
  }
  .num {
    line-height: 32px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
  }
  .body {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 32px;
  }
  .head-label,
  .name {
    font-size: 13px;
    line-height: 18px;
    color: var(--text-muted);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-right: -6px;
  }
  .d-icon.danger:hover:not(:disabled) {
    color: var(--error);
  }
  .always {
    padding: 4px 0 12px;
    font-size: 13px;
    color: var(--text-muted);
  }

  /* Condition and destination rows: name | values | remove. */
  .row {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr) 32px;
    grid-template-areas: 'name values remove';
    column-gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
  }
  .row .name {
    grid-area: name;
    display: flex;
    align-items: center;
    min-height: var(--d-ctl);
    color: var(--text-primary);
  }
  .goto .name {
    color: var(--text-muted);
  }
  .values {
    grid-area: values;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .values .d-hint {
    margin-top: 0;
  }
  .remove {
    grid-area: remove;
    margin-top: calc((var(--d-ctl) - 32px) / 2);
  }
  .days .d-key > span {
    padding: 0;
    font-size: 12px;
  }
  .range {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .range .d-field {
    flex: 1 1 0;
    min-width: 0;
    padding: 0 8px;
    font-variant-numeric: tabular-nums;
  }
  .to {
    font-size: 13px;
    color: var(--text-muted);
  }
  .add {
    padding: 4px 0 8px;
  }
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 4px;
  }
  .pick {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }
  .d-seg {
    align-self: flex-start;
  }
  .split {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .split .url {
    flex: 1 1 auto;
    min-width: 0;
  }
  .weight {
    flex: none;
    width: 76px;
    --d-unit-pad: 28px;
  }
  .split-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .total {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--error);
  }
  .total.ok {
    color: var(--accent);
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 16px;
  }
  .cap {
    font-size: 13px;
    color: var(--text-muted);
  }

  @media (max-width: 639px) {
    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'name remove' 'values values';
      row-gap: 4px;
    }
    .row .name {
      min-height: 44px;
    }
    .remove {
      margin-top: 0;
    }
    .pick {
      height: 44px;
    }
  }
</style>
