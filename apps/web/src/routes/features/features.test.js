import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

import FeaturePage from './[feature]/+page.svelte';
import { load, entries } from './[feature]/+page.js';
import { FEATURE_PAGES, featureSlugs, planLabel } from '#lib/marketing/features.js';
import { FEATURES, PRODUCTS, formatDay } from '#lib/marketing/facts.js';
import { marketingPage } from '#lib/marketing/pages.js';

afterEach(cleanup);

const SLUGS = ['link-in-bio', 'smart-routing', 'password-protected-links', 'link-expiry', 'one-time-links'];

describe('/features/[feature] load', () => {
  it('404s on an unknown slug', () => {
    expect(() => load({ params: { feature: 'nope' } })).toThrow(expect.objectContaining({ status: 404 }));
  });
  it.each(SLUGS)('returns the slug for %s', (slug) => {
    expect(load({ params: { feature: slug } })).toEqual({ slug });
  });
  it('lists all five slugs in entries()', () => {
    expect(entries()).toEqual(SLUGS.map((feature) => ({ feature })));
    expect(featureSlugs()).toEqual(SLUGS);
  });
  it('registers each slug in the marketing registry', () => {
    for (const s of SLUGS) {
      const p = marketingPage(`/features/${s}`);
      expect(p, s).toBeDefined();
      expect(p.kind).toBe('feature');
      expect(p.title).toBe(FEATURE_PAGES[s].title);
    }
  });
});

describe('feature copy', () => {
  it.each(SLUGS)('%s has 3 to 5 steps, a limit, an FAQ and valid factIds', (slug) => {
    const c = FEATURE_PAGES[slug];
    expect(c.steps.length).toBeGreaterThanOrEqual(3);
    expect(c.steps.length).toBeLessThanOrEqual(5);
    expect(c.limit.length).toBeGreaterThan(0);
    expect(c.faq.length).toBeGreaterThan(0);
    for (const id of c.factIds) expect(FEATURES.some((f) => f.id === id), id).toBe(true);
    expect(c.example).toBeUndefined();
  });
  it('tells link-in-bio users to select Add link', () => {
    expect(FEATURE_PAGES['link-in-bio'].steps.join(' ')).toMatch(/select Add link/);
  });
  it('names the icon-only settings gear by what it looks like', () => {
    for (const slug of ['smart-routing', 'password-protected-links', 'link-expiry']) {
      const steps = FEATURE_PAGES[slug].steps.join(' ');
      expect(steps, slug).not.toMatch(/Select Settings/);
      expect(steps, slug).toMatch(/Select the gear \(Settings\) next to the link/);
    }
  });
  it('contains no middle dots or emojis', () => {
    for (const c of Object.values(FEATURE_PAGES)) {
      const all = JSON.stringify(c);
      expect(all).not.toMatch(/·/);
      expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('planLabel', () => {
  it('reads the plan from the facts', () => {
    expect(planLabel('smart-routing')).toBe('Free');
    const paid = [{ id: 'x', label: 'x', iksi: { value: 'v', offered: true, plan: 'paid', feature: 'smart-routing' }, competitors: {} }];
    expect(planLabel('smart-routing', paid)).toBe('Paid');
  });
  it('is null when the facts do not offer it', () => {
    const none = [{ id: 'x', label: 'x', iksi: { value: 'v', offered: false, feature: 'smart-routing' }, competitors: {} }];
    expect(planLabel('smart-routing', none)).toBeNull();
    expect(planLabel('smart-routing', [])).toBeNull();
  });
});

describe('feature page', () => {
  it.each(SLUGS)('renders h1, answer, plan label, steps, limit, links and FAQ for %s', (slug) => {
    const { container } = render(FeaturePage, { props: { data: { slug } } });
    const c = FEATURE_PAGES[slug];
    const html = container.innerHTML;
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(html).toContain(c.answer);
    expect(container.querySelector('[data-plan]').textContent).toContain(planLabel(slug));
    for (const s of c.steps) expect(html).toContain(s);
    expect(html).toContain(c.limit);
    expect(html).toContain(c.faq[0].q);
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/alternatives');
  });
  it.each(SLUGS)('styles every inline link as a text link on %s', (slug) => {
    const { container } = render(FeaturePage, { props: { data: { slug } } });
    const links = [...container.querySelectorAll('p a, li a')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.classList.contains('text-link'), a.textContent).toBe(true);
  });
  it.each(SLUGS)('dates the plan label from the facts on %s', (slug) => {
    const { container } = render(FeaturePage, { props: { data: { slug } } });
    expect(container.textContent).toContain(`checked ${formatDay(PRODUCTS.iksi.verified)}`);
  });
  it('renders the iksi fact values for each factId', () => {
    const { container } = render(FeaturePage, { props: { data: { slug: 'smart-routing' } } });
    for (const id of FEATURE_PAGES['smart-routing'].factIds) {
      expect(container.innerHTML).toContain(FEATURES.find((f) => f.id === id).iksi.value);
    }
  });
  it('renders no example block when example is unset', () => {
    const { container } = render(FeaturePage, { props: { data: { slug: 'link-in-bio' } } });
    expect(container.querySelector('[data-example]')).toBeNull();
  });
  it('renders an example link when example is set', () => {
    const saved = FEATURE_PAGES['link-in-bio'].example;
    FEATURE_PAGES['link-in-bio'].example = { shortURL: 'abc123', note: 'A live profile row.' };
    try {
      const { container } = render(FeaturePage, { props: { data: { slug: 'link-in-bio' } } });
      const a = container.querySelector('[data-example] a');
      expect(a.getAttribute('href')).toBe('https://www.iksi.app/abc123');
      expect(a.classList.contains('text-link')).toBe(true);
      expect(container.querySelector('[data-example]').textContent).toContain('A live profile row.');
    } finally {
      FEATURE_PAGES['link-in-bio'].example = saved;
    }
  });
});
