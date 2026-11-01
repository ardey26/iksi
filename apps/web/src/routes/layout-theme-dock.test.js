// A fixed corner theme toggle covered page content on phones (row actions on
// the dashboard, buttons on public pages). It now sits in the site header, in
// the page flow, on every page, so nothing can scroll under it.
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

const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/') }));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));

import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));

function at(path) {
  page.url = new URL(`https://www.iksi.app${path}`);
  const { container } = render(Layout, { props: { data: { user: null }, children } });
  const toggle = container.querySelector('button[aria-label="Toggle theme"]');
  return { toggle, header: container.querySelector('header'), main: container.querySelector('main') };
}

const follows = (a, b) => (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('theme toggle placement', () => {
  it.each(['/', '/AbC', '/@andre/sale', '/dashboard', '/dashboard/links', '/login'])('sits in the header, before the content, on %s', (path) => {
    const { toggle, header, main } = at(path);
    expect(header.contains(toggle)).toBe(true);
    expect(follows(main, header)).toBe(true);
  });

  it('is never a fixed overlay', () => {
    const { toggle } = at('/');
    expect(toggle.closest('.fixed, .theme-dock')).toBeNull();
  });
});
