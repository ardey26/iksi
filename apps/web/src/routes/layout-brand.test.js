// On the home page the wordmark is the brand, so the header leaves its own
// out; every other page keeps it as the way home.
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
  page.url = new URL(href);
  page.route = { id: routeId };
  return render(Layout, { props: { data: { user: null }, children } }).container;
}

describe('header brand', () => {
  it('leaves the brand out of the home page header, keeping its controls', () => {
    const container = at('https://www.iksi.app/', '/');
    expect(container.querySelector('a.brand')).toBeNull();
    expect(container.querySelector('a[href$="/login"]')).not.toBeNull();
  });

  it('keeps the brand on every other page', () => {
    for (const [href, id] of [
      ['https://www.iksi.app/privacy', '/privacy'],
      ['https://www.iksi.app/alternatives', '/alternatives'],
      ['https://www.iksi.app/login', '/login']
    ]) {
      expect(at(href, id).querySelector('a.brand')?.getAttribute('href')).toBe('/');
    }
  });
});
