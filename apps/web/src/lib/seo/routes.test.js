import { describe, it, expect, vi } from 'vitest';

vi.mock('#lib/marketing/pages.js', () => {
  const MARKETING_PAGES = [{ path: '/features/x', title: 'T', description: 'D', kind: 'feature' }];
  return { MARKETING_PAGES, marketingPage: (p) => MARKETING_PAGES.find((e) => e.path === p) };
});

import { seoForRoute } from './routes.js';
import { CHROME_EXTENSION_URL } from '../extension-store';

const HOST = 'www.iksi.app';

describe('seoForRoute', () => {
  it('indexes the homepage', () => {
    const seo = seoForRoute('/', HOST);
    expect(seo.noindex).toBe(false);
    expect(seo.title).toBe('iksi — free URL shortener. Make long links short.');
  });
  it('indexes /privacy', () => {
    expect(seoForRoute('/privacy', HOST).noindex).toBe(false);
  });
  it('noindexes app routes', () => {
    expect(seoForRoute('/dashboard', HOST).noindex).toBe(true);
  });
  it('noindexes admin hosts', () => {
    expect(seoForRoute('/', 'admin.iksi.app').noindex).toBe(true);
    expect(seoForRoute('/', 'admin.localhost').noindex).toBe(true);
  });
  it('serves registered marketing pages', () => {
    expect(seoForRoute('/features/x', HOST)).toMatchObject({
      title: 'T',
      description: 'D',
      canonical: 'https://www.iksi.app/features/x',
      noindex: false
    });
  });
  it('noindexes unregistered marketing paths', () => {
    expect(seoForRoute('/features/not-registered', HOST).noindex).toBe(true);
  });
  it('puts Organization in the homepage graph', () => {
    const graph = seoForRoute('/', HOST).structuredData['@graph'];
    const org = graph.find((n) => n['@type'] === 'Organization');
    expect(org['@id']).toBe('https://www.iksi.app/#org');
    expect(org.sameAs).toEqual(['https://github.com/ardey26/iksi', CHROME_EXTENSION_URL]);
    expect(graph.find((n) => n['@type'] === 'WebApplication').author).toEqual({ '@id': 'https://www.iksi.app/#org' });
  });
});
