// DESIGN.md › Principles: no middle-dot separators in UI copy or metadata.
// Separate facts go on separate lines, in columns, or in a short sentence.
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Home from './+page.svelte';
import Links from './links/+page.svelte';
import Profile from './profile/+page.svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

const sources: Record<string, string> = {
  ...import.meta.glob('/src/routes/\\(app\\)/dashboard/**/*.svelte', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob(
    [
      '/src/lib/components/links/*.svelte',
      '/src/lib/components/{ApiKeys,PaymentMethods,ImageUpload}.svelte',
      '/src/lib/format.ts'
    ],
    { query: '?raw', import: 'default', eager: true }
  )
};

describe('dashboard copy', () => {
  it('covers the dashboard files', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(12);
  });

  it.each(Object.entries(sources))('%s has no middle dot', (_path, source) => {
    expect(source).not.toMatch(/·|&middot;|&#183;|&#xB7;|\\u00b7/i);
  });
});

// The rendered screens too: copy that is built from data (dates, places,
// counts) never joins facts with a dot either.

const now = new Date().toISOString();
const settings = { destination: 'https://example.com/a', rules: [{ id: 'aaaaaaa1', when: { countries: ['SG'] }, destination: 'https://sg.example.com' }], expiresAt: now, maxClicks: 5, hasPassword: true, permanent: false };
const user = { id: 1, handle: 'ana', profileId: 3, twitterHandle: null, googleEmail: 'ana@x.com' };
const SCREENS: [string, any, Record<string, unknown>][] = [
  ['home', Home, { data: { user, apiKeys: [{ id: 1, name: 'Laptop', prefix: 'iksi_ab12', createdAt: now, lastUsedAt: now }], streamed: null, subdomains: false } }],
  ['links', Links, { data: { user, scopeCustomNames: true, hasMore: true, limit: 100, totalCount: 240, links: [
    { id: 1, shortURL: 'sale', originalURL: 'https://shop.example.com/sale?x=1', clickCount: 12480, createdAt: now, safeVerdict: 'malware', profileRow: { id: 9, title: 'Shop', enabled: true, position: 0 }, settings },
    { id: 2, shortURL: 'q3', originalURL: 'https://docs.google.com/d/1', clickCount: 3, createdAt: '2025-03-03T00:00:00Z', safeVerdict: null, profileRow: null, settings },
    { id: 3, shortURL: 'OneTime3', originalURL: '', clickCount: 0, createdAt: now, safeVerdict: null, profileRow: null, oneTime: { kind: 'text', state: 'unopened' } }
  ] } }],
  ['profile', Profile, { data: { user, scopeCustomNames: false, profile: { displayName: 'Ana', bio: 'Hi', avatarUrl: null, backgroundUrl: null, theme: '20', accent: '#3B82F6' }, payments: { label: 'pay', methods: [
    { id: 'q1', kind: 'qr', institution: 'gcash', label: 'GCash', payload: 'x', name: 'ANA REYES', city: 'QUEZON CITY', country: 'PH', currency: 'PHP' },
    { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' }
  ] } } }]
];

describe('rendered dashboard screens', () => {
  it.each(SCREENS)('%s renders no middle dot', (_name, Screen, props) => {
    render(Screen, { props });
    expect(document.body.textContent).not.toContain('·');
    cleanup();
  });
});
