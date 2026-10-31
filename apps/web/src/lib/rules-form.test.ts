import { describe, it, expect } from 'vitest';
import { parseRules, type Rule } from '@iksi/core';
import { toForm, fromForm, newRuleId, type RuleForm } from './rules-form';

const EXAMPLES: Rule[] = [
  { id: 'aaaaaaa1', when: { countries: ['SG', 'MY'] }, destination: 'https://sg.example.com' },
  { id: 'aaaaaaa2', when: { continents: ['AS', 'EU'] }, destination: 'https://asia.example.com' },
  { id: 'aaaaaaa3', when: { devices: ['mobile', 'tablet'], os: ['ios'] }, destination: 'https://m.example.com' },
  { id: 'aaaaaaa4', when: { referrerHosts: ['x.com', 'news.ycombinator.com'] }, destination: 'https://x.example.com' },
  {
    id: 'aaaaaaa5',
    when: { time: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', tz: 'Asia/Singapore' } },
    destination: 'https://work.example.com'
  },
  { id: 'aaaaaaa6', when: { time: { start: '22:00', end: '06:00', tz: 'UTC' } }, destination: 'https://night.example.com' },
  {
    id: 'aaaaaaa7',
    when: {},
    split: [
      { destination: 'https://a.example.com', weight: 70 },
      { destination: 'https://b.example.com', weight: 30 }
    ]
  }
];

function single(over: Partial<RuleForm> = {}): RuleForm {
  return { id: 'bbbbbbb1', conditions: [], mode: 'single', destination: 'https://a.example.com', split: [], ...over };
}

describe('rules-form', () => {
  it('round-trips every example rule', () => {
    const parsed = parseRules(EXAMPLES);
    if (!parsed.ok) throw new Error(parsed.error);
    const out = fromForm(toForm(EXAMPLES));
    expect(out).toEqual({ ok: true, rules: parsed.rules });
  });

  it('normalizes referrer hosts the way parseRules does', () => {
    const rules: Rule[] = [{ id: 'ccccccc1', when: { referrerHosts: ['WWW.X.com'] }, destination: 'https://a.example.com' }];
    const parsed = parseRules(rules);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(fromForm(toForm(rules))).toEqual({ ok: true, rules: parsed.rules });
  });

  it('trims and upper-cases comma-separated countries', () => {
    const r = fromForm([single({ conditions: [{ kind: 'country', values: ' sg, my ,,Id ' }] })]);
    expect(r).toEqual({
      ok: true,
      rules: [{ id: 'bbbbbbb1', when: { countries: ['SG', 'MY', 'ID'] }, destination: 'https://a.example.com' }]
    });
  });

  it('drops conditions with no values', () => {
    const r = fromForm([
      single({
        conditions: [
          { kind: 'country', values: ' , ' },
          { kind: 'continent', values: [] },
          { kind: 'device', values: [] },
          { kind: 'os', values: [] },
          { kind: 'referrer', values: '' }
        ]
      })
    ]);
    expect(r).toEqual({ ok: true, rules: [{ id: 'bbbbbbb1', when: {}, destination: 'https://a.example.com' }] });
  });

  it('omits days when none are chosen', () => {
    const r = fromForm([single({ conditions: [{ kind: 'time', days: [], start: '09:00', end: '17:00', tz: 'UTC' }] })]);
    expect(r).toEqual({
      ok: true,
      rules: [{ id: 'bbbbbbb1', when: { time: { start: '09:00', end: '17:00', tz: 'UTC' } }, destination: 'https://a.example.com' }]
    });
  });

  it('rejects a split that adds to 90', () => {
    const r = fromForm([
      single({
        mode: 'split',
        destination: '',
        split: [
          { destination: 'https://a.example.com', weight: '60' },
          { destination: 'https://b.example.com', weight: '30' }
        ]
      })
    ]);
    expect(r).toEqual({ ok: false, error: 'Rule 1: weights must add up to 100' });
  });

  it('names the rule when the destination is missing', () => {
    const r = fromForm([single(), single({ id: 'bbbbbbb2', destination: '  ' })]);
    expect(r).toEqual({ ok: false, error: 'Rule 2: add a destination' });
  });

  it('names the rule when a split destination is missing', () => {
    const r = fromForm([
      single({
        mode: 'split',
        split: [
          { destination: 'https://a.example.com', weight: '50' },
          { destination: '', weight: '50' }
        ]
      })
    ]);
    expect(r).toEqual({ ok: false, error: 'Rule 1: add a destination to every split row' });
  });

  it('adds https:// to a bare destination', () => {
    const r = fromForm([single({ destination: 'example.com/x' })]);
    expect(r.ok && r.rules[0]).toMatchObject({ destination: 'https://example.com/x' });
  });

  it('newRuleId makes 8 safe characters', () => {
    for (let i = 0; i < 50; i++) expect(newRuleId()).toMatch(/^[A-Za-z0-9_-]{8}$/);
    expect(newRuleId()).not.toBe(newRuleId());
  });
});
