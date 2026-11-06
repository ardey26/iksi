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
    { path: '/alternatives/bitly', title: 'Bitly alternative | iksi', label: 'Bitly alternative', description: 'd', kind: 'alternatives' },
    { path: '/features/qr', title: 'QR codes | iksi', label: 'QR codes', description: 'd', kind: 'feature' },
    { path: '/tools/utm', title: 'UTM builder | iksi', label: 'UTM builder', description: 'd', kind: 'tool' },
    { path: '/docs/api', title: 'API docs | iksi', label: 'API docs', description: 'd', kind: 'docs' }
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
  { path: '/alternatives/bitly', title: 'Bitly alternative | iksi', label: 'Bitly alternative', description: 'd', kind: 'alternatives' },
  { path: '/features/qr', title: 'QR codes | iksi', label: 'QR codes', description: 'd', kind: 'feature' },
  { path: '/tools/utm', title: 'UTM builder | iksi', label: 'UTM builder', description: 'd', kind: 'tool' },
  { path: '/docs/api', title: 'API docs | iksi', label: 'API docs', description: 'd', kind: 'docs' }
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
    for (const p of all) {
      const a = container.querySelector(`a[href="${p.path}"]`);
      expect(a).not.toBeNull();
      expect(a.textContent).toBe(p.label);
      expect(a.textContent).not.toContain('|');
    }
    expect(container.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('groups Privacy, Report a link and the Chrome extension, in that order', () => {
    const legal = render(SiteFooter).container.querySelector('section[aria-label="Legal"]');
    expect([...legal.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href')])).toEqual([
      ['Privacy', '/privacy'],
      ['Report a link', '/report'],
      ['Chrome extension', 'https://chromewebstore.google.com/detail/iksi/fjlijiannnmnggbaknnkcloofcoeejnf']
    ]);
  });

  it('renders only the legal links when the registry is empty', () => {
    registry.pages = [];
    const { container } = render(SiteFooter);
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/privacy',
      '/report',
      'https://chromewebstore.google.com/detail/iksi/fjlijiannnmnggbaknnkcloofcoeejnf'
    ]);
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
