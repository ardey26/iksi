<script lang="ts">
  // Routing rules inside the link settings sheet. Rules are reordered with
  // the kit's SortableList (drag the grip, or Space and the arrow keys on it);
  // the first rule that matches wins.
  import { tick } from 'svelte';
  import { MAX_RULES } from '@iksi/core';
  import type { Continent, Device, Os } from '@iksi/core';
  import {
    Button,
    ChipGroup,
    DragHandle,
    Field,
    IconButton,
    Input,
    Paper,
    Segmented,
    Select,
    SortableList,
    Stack
  } from '#lib/ui/index.js';
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

  const KINDS: { kind: ConditionForm['kind']; label: string; field: string }[] = [
    { kind: 'country', label: 'Country', field: 'Countries' },
    { kind: 'continent', label: 'Continent', field: 'Continents' },
    { kind: 'device', label: 'Device', field: 'Devices' },
    { kind: 'os', label: 'Operating system', field: 'Operating systems' },
    { kind: 'referrer', label: 'Referrer', field: 'Referrer hosts' },
    { kind: 'time', label: 'Time of day', field: 'Time of day' }
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
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, value) => ({ value, label }));
  const MODES = [
    { value: 'single', label: 'One URL' },
    { value: 'split', label: 'A/B split' }
  ];

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
    return [...new Set(['UTC', browserZone(), ...zones])];
  }
  const ZONES = zoneList();
  function zonesWith(tz: string) {
    return (ZONES.includes(tz) ? ZONES : [tz, ...ZONES]).map((z) => ({ value: z, label: z.replace(/_/g, ' ') }));
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
  // SortableList has already moved the row; this keeps `rules` (bound up to
  // the sheet, which saves it) in the same order.
  function onReorder(e: CustomEvent<{ ids: string[] }>) {
    const byId = new Map(rules.map((r) => [r.id, r]));
    rules = e.detail.ids.map((id) => byId.get(id)!).filter(Boolean);
  }

  // Condition picker: "Add condition" reveals the kinds still available for
  // that rule. One picker open at a time.
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
    // Keep Escape from also closing the sheet.
    e.stopPropagation();
    closePicker(rule);
  }
  function addCondition(rule: RuleForm, kind: ConditionForm['kind']) {
    pickerFor = null;
    rule.conditions = [...rule.conditions, defaultCondition(kind)];
    rules = rules;
    focusAfter(`[data-cond="${rule.id}-${kind}"] input`, `[data-cond="${rule.id}-${kind}"] select`);
  }
  function removeCondition(rule: RuleForm, ci: number) {
    rule.conditions = rule.conditions.filter((_, idx) => idx !== ci);
    rules = rules;
    focusAfter(ruleSel(rule.id, 'add-condition'), ruleSel(rule.id, 'remove'));
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
    focusAfter(`[data-rule="${rule.id}"] [data-split="${Math.min(si, rule.split.length - 1)}"]`, ruleSel(rule.id, 'add-split'));
  }
  function total(rule: RuleForm): number {
    return rule.split.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
  }
  function available(rule: RuleForm) {
    const used = new Set(rule.conditions.map((c) => c.kind));
    return KINDS.filter((k) => !used.has(k.kind));
  }
  const kindOf = (kind: string) => KINDS.find((k) => k.kind === kind)!;
  const ruleName = (r: RuleForm) => `Rule ${rules.indexOf(r) + 1}`;
</script>

<div class="editor" bind:this={root}>
  {#if rules.length === 0}
    <p class="empty t-body t-muted">No rules yet. Everyone goes to the destination.</p>
  {:else}
    <Paper padding="none">
      <SortableList items={rules} label="Routing rules" name={ruleName} on:reorder={onReorder} let:item={rule} let:index={i} let:handle>
        <li class="rule">
          <fieldset class="body" aria-label={`Rule ${i + 1}`} data-rule={rule.id}>
            <div class="head">
              <DragHandle {handle} />
              <span class="t-label">Rule {i + 1}</span>
              <span class="grow"></span>
              <IconButton icon="trash" variant="danger" data-act="remove" label={`Remove rule ${i + 1}`} on:click={() => removeRule(i)} />
            </div>

            <Stack gap={16}>
              {#if rule.conditions.length === 0}
                <p class="t-label t-muted always">Always, unless an earlier rule matched.</p>
              {/if}

              {#each rule.conditions as c, ci (c.kind)}
                {@const k = kindOf(c.kind)}
                <div class="cond" data-cond={`${rule.id}-${c.kind}`}>
                  {#if c.kind === 'country'}
                    <Input label={k.field} placeholder="SG, MY, ID" hint="Two-letter codes, separated by commas." bind:value={c.values}>
                      <Button slot="aside" size="sm" variant="ghost" aria-label={`Remove ${k.label} condition`} on:click={() => removeCondition(rule, ci)}>Remove</Button>
                    </Input>
                  {:else if c.kind === 'referrer'}
                    <Input label={k.field} placeholder="x.com, news.ycombinator.com" hint="Subdomains match too. Separate with commas." bind:value={c.values}>
                      <Button slot="aside" size="sm" variant="ghost" aria-label={`Remove ${k.label} condition`} on:click={() => removeCondition(rule, ci)}>Remove</Button>
                    </Input>
                  {:else}
                    <Field label={k.field} group reserve={c.kind === 'time'} hint={c.kind === 'time' ? 'No days means every day. Overnight windows count from their start day.' : ''} let:labelId>
                      <Button slot="aside" size="sm" variant="ghost" aria-label={`Remove ${k.label} condition`} on:click={() => removeCondition(rule, ci)}>Remove</Button>
                      {#if c.kind === 'continent'}
                        <ChipGroup labelledby={labelId} options={CONTINENTS} bind:value={c.values} on:change={() => (rules = rules)} />
                      {:else if c.kind === 'device'}
                        <ChipGroup labelledby={labelId} options={DEVICES} bind:value={c.values} on:change={() => (rules = rules)} />
                      {:else if c.kind === 'os'}
                        <ChipGroup labelledby={labelId} options={OSES} bind:value={c.values} on:change={() => (rules = rules)} />
                      {:else}
                        <Stack gap={12}>
                          <ChipGroup label="Days" options={DAYS} value={c.days} on:change={(e) => { c.days = [...e.detail.value].sort((a, b) => a - b); rules = rules; }} />
                          <div class="range">
                            <Input label="Start" type="time" reserve={false} bind:value={c.start} />
                            <Input label="End" type="time" reserve={false} bind:value={c.end} />
                          </div>
                          <Select label="Time zone" reserve={false} options={zonesWith(c.tz)} bind:value={c.tz} />
                        </Stack>
                      {/if}
                    </Field>
                  {/if}
                </div>
              {/each}

              {#if available(rule).length > 0}
                <div class="add">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="plus"
                    data-act="add-condition"
                    aria-expanded={pickerFor === rule.id}
                    aria-controls={`${rule.id}-picker`}
                    on:click={() => togglePicker(rule)}
                  >Add condition</Button>
                  {#if pickerFor === rule.id}
                    <!-- Escape closes the picker; the buttons inside are the interactive parts. -->
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div class="picker" id={`${rule.id}-picker`} role="group" aria-label="Condition type" on:keydown={(e) => onPickerKey(e, rule)}>
                      {#each available(rule) as kind (kind.kind)}
                        <Button size="sm" data-kind={kind.kind} on:click={() => addCondition(rule, kind.kind)}>{kind.label}</Button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="goto">
                <div class="goto-head">
                  <span class="t-label" id={`${rule.id}-goto`}>Go to</span>
                  <Segmented
                    size="sm"
                    label={`Rule ${i + 1} destination type`}
                    options={MODES}
                    value={rule.mode}
                    on:change={(e) => setMode(rule, e.detail.value)}
                  />
                </div>

                {#if rule.mode === 'single'}
                  <Input label="Go to" hideLabel reserve={false} inputmode="url" placeholder="https://example.com" bind:value={rule.destination} />
                {:else}
                  <Stack gap={8}>
                    {#each rule.split as s, si}
                      <div class="split">
                        <Input label={`Split destination ${si + 1}`} hideLabel reserve={false} inputmode="url" placeholder="https://example.com" data-split={si} bind:value={s.destination} />
                        <div class="weight">
                          <Input label={`Split weight ${si + 1}`} hideLabel reserve={false} inputmode="numeric" placeholder="0" align="end" unit="%" bind:value={s.weight} />
                        </div>
                        <IconButton icon="x" label={`Remove split row ${si + 1}`} disabled={rule.split.length <= MIN_SPLIT} on:click={() => removeSplit(rule, si)} />
                      </div>
                    {/each}
                    <div class="split-foot">
                      <Button size="sm" variant="ghost" icon="plus" data-act="add-split" disabled={rule.split.length >= MAX_SPLIT} on:click={() => addSplit(rule)}>Add split row</Button>
                      <p class="total t-label t-tabular" class:ok={total(rule) === 100} aria-live="polite">
                        {total(rule)} of 100{total(rule) === 100 ? '' : ', must add up to 100'}
                      </p>
                    </div>
                  </Stack>
                {/if}
              </div>
            </Stack>
          </fieldset>
        </li>
      </SortableList>
    </Paper>
  {/if}

  <div class="foot">
    <Button icon="plus" data-act="add-rule" disabled={rules.length >= MAX_RULES} on:click={addRule}>Add rule</Button>
    <span class="t-label t-muted t-tabular">{rules.length} of {MAX_RULES}</span>
  </div>
</div>

<style>
  .empty {
    margin: 0;
    padding: 16px;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: var(--radius-paper);
  }
  .rule {
    padding: 12px 16px 20px;
  }
  .body {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    margin: 0 -8px 12px 0;
  }
  .grow { flex: 1; }
  .always { margin: 0; }
  /* A ghost "Remove" in a field's label line stays on that line's height. */
  .cond :global(.aside) { margin: -7px -12px -7px 0; }
  .add {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin: -4px 0 0 -12px;
  }
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-left: 12px;
  }
  .range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .goto {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .goto-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .split {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .split > :global(:first-child) { flex: 1 1 auto; }
  .weight {
    flex: none;
    width: 88px;
  }
  .split-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-left: -12px;
  }
  .total {
    margin: 0;
    text-align: right;
    color: var(--error);
  }
  .total.ok { color: var(--success); }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 16px;
  }
  @media (max-width: 639px) {
    .rule { padding: 12px 12px 20px; }
  }
</style>
