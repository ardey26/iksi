import { addPrefix } from '#lib/utils/urlValidation.js';
import { parseRules, type Rule, type Continent, type Device, type Os } from '@iksi/core';

/** Client-side mirror of the server's LinkSettings, kept here so no server module reaches the browser. */
export interface LinkSettingsData {
  destination: string;
  rules: Rule[];
  expiresAt: string | null;
  maxClicks: number | null;
  hasPassword: boolean;
  permanent: boolean;
}

export type ConditionForm =
  | { kind: 'country'; values: string }
  | { kind: 'continent'; values: Continent[] }
  | { kind: 'device'; values: Device[] }
  | { kind: 'os'; values: Os[] }
  | { kind: 'referrer'; values: string }
  | { kind: 'time'; days: number[]; start: string; end: string; tz: string };

export interface RuleForm {
  id: string;
  conditions: ConditionForm[];
  mode: 'single' | 'split';
  destination: string;
  split: { destination: string; weight: string }[];
}

type Conditions = Rule['when'];

export function toForm(rules: Rule[]): RuleForm[] {
  return rules.map((rule) => {
    const w = rule.when;
    const conditions: ConditionForm[] = [];
    if (w.countries) conditions.push({ kind: 'country', values: w.countries.join(', ') });
    if (w.continents) conditions.push({ kind: 'continent', values: [...w.continents] });
    if (w.devices) conditions.push({ kind: 'device', values: [...w.devices] });
    if (w.os) conditions.push({ kind: 'os', values: [...w.os] });
    if (w.referrerHosts) conditions.push({ kind: 'referrer', values: w.referrerHosts.join(', ') });
    if (w.time) {
      conditions.push({ kind: 'time', days: [...(w.time.days ?? [])], start: w.time.start, end: w.time.end, tz: w.time.tz });
    }
    if ('split' in rule) {
      return {
        id: rule.id,
        conditions,
        mode: 'split' as const,
        destination: '',
        split: rule.split.map((s) => ({ destination: s.destination, weight: String(s.weight) }))
      };
    }
    return { id: rule.id, conditions, mode: 'single' as const, destination: rule.destination, split: [] };
  });
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function newRuleId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length];
  return id;
}

const list = (s: string) => s.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);

/** What an empty condition of each kind is missing, as the error names it. */
const NOUNS: Record<Exclude<ConditionForm['kind'], 'time'>, string> = {
  country: 'country',
  continent: 'continent',
  device: 'device',
  os: 'operating system',
  referrer: 'referrer'
};

/**
 * A condition the user added but left empty is an error: dropping it would
 * widen the rule to every visitor. Only conditions the user removed are absent.
 */
function buildWhen(conditions: ConditionForm[]): { ok: true; when: Conditions } | { ok: false; noun: string } {
  const when: Conditions = {};
  for (const c of conditions) {
    if (c.kind === 'time') {
      when.time = { start: c.start, end: c.end, tz: c.tz, ...(c.days.length ? { days: c.days } : {}) };
      continue;
    }
    const values = typeof c.values === 'string' ? list(c.values) : c.values;
    if (values.length === 0) return { ok: false, noun: NOUNS[c.kind] };
    if (c.kind === 'country') when.countries = (values as string[]).map((s) => s.toUpperCase());
    else if (c.kind === 'continent') when.continents = c.values;
    else if (c.kind === 'device') when.devices = c.values;
    else if (c.kind === 'os') when.os = c.values;
    else when.referrerHosts = values as string[];
  }
  return { ok: true, when };
}

/** Builds rules from the editor state. The result always passes parseRules; its errors name the rule. */
export function fromForm(forms: RuleForm[]): { ok: true; rules: Rule[] } | { ok: false; error: string } {
  const raw: unknown[] = [];
  for (let i = 0; i < forms.length; i++) {
    const f = forms[i];
    const built = buildWhen(f.conditions);
    if (!built.ok) return { ok: false, error: `Rule ${i + 1}: choose at least one ${built.noun}` };
    const when = built.when;
    if (f.mode === 'split') {
      if (f.split.some((s) => !s.destination.trim())) {
        return { ok: false, error: `Rule ${i + 1}: add a destination to every split row` };
      }
      raw.push({
        id: f.id,
        when,
        split: f.split.map((s) => ({
          destination: addPrefix(s.destination),
          weight: s.weight.trim() === '' ? 0 : Number(s.weight)
        }))
      });
    } else {
      if (!f.destination.trim()) return { ok: false, error: `Rule ${i + 1}: add a destination` };
      raw.push({ id: f.id, when, destination: addPrefix(f.destination) });
    }
  }
  return parseRules(raw);
}
