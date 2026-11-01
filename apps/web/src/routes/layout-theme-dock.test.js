// The fixed bottom-right theme toggle covered row actions (such as Revoke) on
// narrow dashboard screens. There it now sits in the page flow, after the
// content, so nothing can scroll under it. The 640px switch itself is CSS.
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

function dockAt(path) {
  page.url = new URL(`https://www.iksi.app${path}`);
  const { container } = render(Layout, { props: { data: { user: null }, children } });
  const toggle = container.querySelector('button[aria-label="Toggle theme"]');
  const main = container.querySelector('main');
  return { dock: toggle.parentElement, main };
}

const follows = (a, b) => (b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('theme toggle placement', () => {
  it.each(['/dashboard', '/dashboard/links', '/dashboard/profile'])('sits after the content on %s', (path) => {
    const { dock, main } = dockAt(path);
    expect(dock.classList.contains('in-flow')).toBe(true);
    expect(follows(dock, main)).toBe(true);
  });

  it.each(['/', '/AbC', '/@andre/sale'])('stays a fixed corner button on %s', (path) => {
    const { dock } = dockAt(path);
    expect(dock.classList.contains('theme-dock')).toBe(true);
    expect(dock.classList.contains('in-flow')).toBe(false);
  });
});
