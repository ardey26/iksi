// Owner rule (DESIGN.md › Principles): no middle-dot separators anywhere in
// UI copy or metadata. Renders every public screen and state and checks the
// markup and the head.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

const page = vi.hoisted(() => ({
  status: 404,
  error: null,
  url: new URL('https://www.iksi.app/AbC'),
  params: { slug: 'AbC' },
  route: { id: '/[slug]' }
}));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }), applyAction: async () => {} }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,AA==' } }));

import Layout from './+layout.svelte';
import Home from './+page.svelte';
import RootError from './+error.svelte';
import LinkPage from './[slug]/+page.svelte';
import LinkErrorPage from './[slug]/+error.svelte';
import Profile from './@[handle]/+page.svelte';
import ProfileError from './@[handle]/+error.svelte';
import ReportPage from './report/+page.svelte';
import PrivacyPage from './privacy/+page.svelte';

const DOT = /·|&middot;|&#183;|&#xb7;/i;

function noDots() {
  expect(document.body.innerHTML).not.toMatch(DOT);
  expect(document.head.innerHTML).not.toMatch(DOT);
  expect(document.title).not.toMatch(DOT);
}

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  vi.unstubAllGlobals();
});

const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));
const user = { twitterHandle: 'ann', googleEmail: null, handle: 'ann', displayName: 'Ann Reyes', avatarUrl: null };

describe('public markup has no middle dots', () => {
  it.each([
    ['/', '/'],
    ['/AbC', '/[slug]'],
    ['/login', '/login'],
    ['/privacy', '/privacy']
  ])('site chrome on %s, signed out and in', async (path, id) => {
    page.url = new URL(`https://www.iksi.app${path}`);
    page.route = { id };
    render(Layout, { props: { data: { user: null }, children } });
    noDots();
    cleanup();
    render(Layout, { props: { data: { user }, children } });
    const menu = screen.queryByRole('button', { name: 'Account menu' });
    if (menu) await fireEvent.click(menu);
    noDots();
  });

  it('home: form, one-time form and result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ shortURL: 'AbCdEf' }))));
    render(Home);
    noDots();
    await fireEvent.click(screen.getByRole('radio', { name: 'One-time link' }));
    noDots();
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com/doc' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await screen.findByText(/AbCdEf/);
    noDots();
  });

  it('error pages', () => {
    for (const status of [403, 404, 410, 500]) {
      page.status = status;
      render(RootError);
      noDots();
      render(ProfileError);
      noDots();
      cleanup();
    }
  });

  it.each([
    [404, { message: 'not found' }],
    [410, { message: 'x', view: 'expired' }],
    [410, { message: 'x', view: 'opened' }],
    [403, { message: 'x', view: 'flagged', verdict: 'phishing' }],
    [403, { message: 'x', view: 'flagged', verdict: 'review' }],
    [403, { message: 'x', view: 'flagged', verdict: 'disabled' }]
  ])('link error %s %j', (status, error) => {
    page.status = status;
    page.error = error;
    render(LinkErrorPage);
    noDots();
  });

  it.each([
    [{ view: 'password', error: 'Wrong password' }, null],
    [{ view: 'reveal', kind: 'text', password: true, error: null }, null],
    [{ view: 'reveal', kind: 'url', password: false, error: null }, { opened: true }],
    [{ view: 'opened' }, { text: 'hello' }],
    [{ view: 'preview', host: 'example.com', destination: 'https://example.com/a', hasRules: true, flagged: null, expired: false }, null],
    [{ view: 'preview', host: '', destination: null, hasRules: false, flagged: null, expired: false, oneTime: true, opened: false }, null],
    [{ view: 'preview', host: 'example.com', destination: null, hasRules: false, flagged: 'malware', expired: false }, null],
    [{ view: 'preview', host: 'example.com', destination: null, hasRules: false, flagged: 'review', expired: false }, null]
  ])('link page %j', (data, form) => {
    page.url = new URL('https://www.iksi.app/AbC+');
    render(LinkPage, { data, form });
    noDots();
  });

  it.each([
    [{ link: 'iksi.app/abc' }, null],
    [{ link: '' }, { errors: { link: 'Enter the short link.', reason: 'Choose a reason.', form: 'Try again later.' }, values: { link: '', reason: '', details: '', email: '' } }],
    [{ link: '' }, { sent: true }]
  ])('report page %j %j', (data, form) => {
    page.url = new URL('https://www.iksi.app/report');
    render(ReportPage, { data, form });
    noDots();
  });

  it('report page links to the privacy policy', () => {
    page.url = new URL('https://www.iksi.app/report');
    const { container } = render(ReportPage, { data: { link: '' }, form: null });
    expect(container.querySelector('a[href="/privacy#reports"]')?.textContent).toBe('Privacy');
  });

  it('privacy page', () => {
    page.url = new URL('https://www.iksi.app/privacy');
    render(PrivacyPage);
    noDots();
  });

  it('profile, its share menu and the pay sheet', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ payloads: { q1: 'PAYLOAD' } }) })));
    const pay = {
      label: 'pay',
      methods: [
        { id: 'q1', kind: 'qr', label: 'GCash', institution: 'gcash', name: 'ANA REYES', city: 'MANILA', country: 'PH', currency: 'PHP' },
        { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' }
      ]
    };
    const data = {
      handle: 'ann',
      displayName: 'Ann Reyes',
      bio: 'Hello',
      avatarUrl: null,
      backgroundUrl: null,
      theme: '20',
      accent: '#3b82f6',
      publicClicks: true,
      rows: [
        { id: 1, title: 'Site', shortURL: 'abc', href: '/abc', clicks: 1200 },
        { id: 2, title: 'Gone', shortURL: null, href: null, clicks: null }
      ],
      sameAs: [],
      pay,
      subdomains: false
    };
    render(Profile, { data });
    noDots();
    await fireEvent.click(screen.getByRole('button', { name: 'Share Site' }));
    noDots();
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for Ana Reyes');
    noDots();
  });
});
