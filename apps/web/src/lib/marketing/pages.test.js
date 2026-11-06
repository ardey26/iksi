import { describe, it, expect } from 'vitest';
import { classifyPath } from '@iksi/core';
import { MARKETING_PAGES, marketingPage } from './pages.js';

describe('MARKETING_PAGES', () => {
  it('only lives under the reserved marketing prefixes', () => {
    for (const p of MARKETING_PAGES) {
      expect(p.path, p.path).toMatch(/^\/(alternatives|features|tools|docs)(\/|$)/);
    }
  });
  it('classifies every path as reserved', () => {
    for (const p of MARKETING_PAGES) {
      expect(classifyPath(p.path).kind, p.path).toBe('reserved');
    }
  });
  it('keeps titles and descriptions within search limits and on brand', () => {
    for (const p of MARKETING_PAGES) {
      expect(p.title.length, p.path).toBeLessThanOrEqual(60);
      expect(p.description.length, p.path).toBeLessThanOrEqual(160);
      expect(p.title.toLowerCase(), p.path).toContain('iksi');
      expect(p.description.toLowerCase(), p.path).toContain('iksi');
    }
  });
  it('has a short label without a brand separator', () => {
    for (const p of MARKETING_PAGES) {
      expect(p.label.length, p.path).toBeGreaterThan(0);
      expect(p.label.length, p.path).toBeLessThanOrEqual(30);
      expect(p.label, p.path).not.toMatch(/[|\u00b7]/);
    }
  });
  it('puts the Organization that WebApplication.author points at in every graph', () => {
    for (const p of MARKETING_PAGES) {
      const graph = p.structuredData()['@graph'];
      const ids = new Set(graph.map((n) => n['@id']).filter(Boolean));
      expect(ids.has('https://www.iksi.app/#org'), p.path).toBe(true);
      const app = graph.find((n) => n['@type'] === 'WebApplication');
      expect(ids.has(app.author['@id']), p.path).toBe(true);
    }
  });
  it('looks pages up by path', () => {
    for (const p of MARKETING_PAGES) expect(marketingPage(p.path)).toBe(p);
    expect(marketingPage('/nope')).toBeUndefined();
  });
});

// Fails if a marketing route ships without a registry entry (it would be noindex).
describe('marketing routes', () => {
  const pageFiles = import.meta.glob('/src/routes/{alternatives,features,tools,docs}/**/+page.svelte');
  const loaders = import.meta.glob('/src/routes/{alternatives,features,tools,docs}/**/+page.{js,ts}');

  const routeOf = (file) => file.replace('/src/routes', '').replace(/\/\+page\.svelte$/, '');

  it('registers every static route', () => {
    for (const file of Object.keys(pageFiles)) {
      const route = routeOf(file);
      if (route.includes('[')) continue;
      expect(marketingPage(route), route).toBeDefined();
    }
  });

  it('registers every entry of every dynamic route', async () => {
    for (const file of Object.keys(pageFiles)) {
      const route = routeOf(file);
      if (!route.includes('[')) continue;
      const key = Object.keys(loaders).find((k) => k.startsWith(`/src/routes${route}/+page.`));
      expect(key, `${route} needs a +page.js exporting entries()`).toBeDefined();
      const mod = await loaders[key]();
      expect(typeof mod.entries, `${route} entries()`).toBe('function');
      const param = route.match(/\[([^\]]+)\]/)[1];
      for (const entry of await mod.entries()) {
        const path = route.replace(/\[[^\]]+\]/, entry[param]);
        expect(marketingPage(path), path).toBeDefined();
      }
    }
  });
});
