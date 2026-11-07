// Every marketing page uses the page rhythm the privacy page set: room under
// the site header and above the footer (the `marketing` page column).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(), toDataURL: vi.fn() } }));

import Hub from './alternatives/+page.svelte';
import CompetitorPage from './alternatives/[competitor]/+page.svelte';
import FeaturePage from './features/[feature]/+page.svelte';
import QrPage from './tools/qr-code/+page.svelte';
import CheckerPage from './tools/link-checker/+page.svelte';
import ExpanderPage from './tools/url-expander/+page.svelte';

afterEach(cleanup);

describe('marketing page spacing', () => {
  it.each([
    ['hub', Hub, {}],
    ['competitor', CompetitorPage, { data: { id: 'linktree' } }],
    ['feature', FeaturePage, { data: { slug: 'link-in-bio' } }],
    ['qr tool', QrPage, {}],
    ['link checker', CheckerPage, {}],
    ['url expander', ExpanderPage, {}]
  ])('%s page uses the marketing page column', (_name, Page, props) => {
    const { container } = render(Page, { props });
    expect(container.querySelector('.page-column.marketing')).not.toBeNull();
  });
});
