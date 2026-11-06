// The site footer: links every marketing page by kind plus Privacy, and the
// layout shows it only on the homepage, /privacy and marketing pages.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

const registry = vi.hoisted(() => ({
  pages: [
    { path: '/alternatives/bitly', title: 'Bitly alternative', description: 'd', kind: 'alternatives' },
    { path: '/features/qr', title: 'QR codes', description: 'd', kind: 'feature' },
    { path: '/tools/utm', title: 'UTM builder', description: 'd', kind: 'tool' },
    { path: '/docs/api', title: 'API docs', description: 'd', kind: 'docs' }
  ]
}));
vi.mock('#lib/marketing/pages.js', () => ({
  get MARKETING_PAGES() {
    return registry.pages;
  },
  marketingPage: (p) => registry.pages.find((x) => x.path === p)
}));

const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/'), route: { id: '/' } }));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));

import SiteFooter from './SiteFooter.svelte';
import Layout from '../../routes/+layout.svelte';

const all = [
  { path: '/alternatives/bitly', title: 'Bitly alternative', description: 'd', kind: 'alternatives' },
  { path: '/features/qr', title: 'QR codes', description: 'd', kind: 'feature' },
  { path: '/tools/utm', title: 'UTM builder', description: 'd', kind: 'tool' },
  { path: '/docs/api', title: 'API docs', description: 'd', kind: 'docs' }
];

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  registry.pages = all;
});

describe('SiteFooter', () => {
  it('renders four groups, each registry path and Privacy', () => {
    const { container } = render(SiteFooter);
    for (const name of ['Compare', 'Features', 'Tools', 'Developers']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    for (const p of all) expect(container.querySelector(`a[href="${p.path}"]`)).not.toBeNull();
    expect(container.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('renders only Privacy when the registry is empty', () => {
    registry.pages = [];
    const { container } = render(SiteFooter);
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/privacy']);
  });
});

describe('layout footer', () => {
  function renderAt(url, route = { id: url }) {
    page.url = new URL(url);
    page.route = route;
    const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));
    return render(Layout, { props: { data: { user: null }, children } });
  }

  it.each(['https://www.iksi.app/', 'https://www.iksi.app/privacy', 'https://www.iksi.app/features/qr'])('shows on %s', (url) => {
    const { container } = renderAt(url);
    expect(container.querySelector('footer')).not.toBeNull();
  });

  it.each([
    ['https://www.iksi.app/dashboard', { id: '/dashboard' }],
    ['https://www.iksi.app/@ann', { id: '/@[handle]' }],
    ['https://www.iksi.app/@ann/sale', { id: '/@[handle]/[name]' }],
    ['https://www.iksi.app/abc+', { id: '/[code]+' }],
    ['https://www.iksi.app/abc', { id: '/[code]' }],
    ['https://admin.iksi.app/', { id: '/' }]
  ])('hides on %s', (url, route) => {
    const { container } = renderAt(url, route);
    expect(container.querySelector('footer')).toBeNull();
  });
});
