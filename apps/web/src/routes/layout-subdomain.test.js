// On andre.iksi.app the URL path is not the route: `/` is the profile and
// `/sale` is @andre/sale. The layout must go by the route, and send app links
// to www, where the session cookie is.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/'), route: { id: '/' } }));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));

import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));

function at(href, routeId) {
  document.head.innerHTML = '';
  page.url = new URL(href);
  page.route = { id: routeId };
  const { container } = render(Layout, { props: { data: { user: null }, children } });
  return { container, canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') };
}

describe('layout on a profile subdomain', () => {
  it('treats andre.iksi.app/ as the profile page: no site chrome, no site SEO', () => {
    const { container, canonical } = at('https://andre.iksi.app/', '/@[handle]');
    expect(canonical).toBeUndefined();
    expect(container.querySelector('a[href$="/login"]')).toBeNull();
  });

  it('sends home and sign in to www from a subdomain link page', () => {
    const { container, canonical } = at('https://andre.iksi.app/sale', '/@[handle]/[name]');
    expect(container.querySelector('a.fixed')?.getAttribute('href')).toBe('https://www.iksi.app/');
    expect(container.querySelector('a[href$="/login"]')?.getAttribute('href')).toBe('https://www.iksi.app/login');
    expect(canonical).toBe('https://andre.iksi.app/sale');
  });

  it('keeps relative links and www canonicals on www', () => {
    const { container, canonical } = at('https://www.iksi.app/@andre/sale', '/@[handle]/[name]');
    expect(container.querySelector('a.fixed')?.getAttribute('href')).toBe('/');
    expect(container.querySelector('a[href$="/login"]')?.getAttribute('href')).toBe('/login');
    expect(canonical).toBe('https://www.iksi.app/@andre/sale');
  });

  it('leaves ?via=sub out of the canonical', () => {
    expect(at('https://www.iksi.app/@andre/sale?via=sub', '/@[handle]/[name]').canonical).toBe('https://www.iksi.app/@andre/sale');
  });
});
