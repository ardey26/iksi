import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { toasts } from '#lib/ui/toast.js';
import Page from './+page.svelte';
import { load as appLayout } from '../+layout.server';

const show = (subdomains) =>
  render(Page, { props: { data: { user: { id: 1, handle: 'ana', profileId: 3 }, apiKeys: [], streamed: null, subdomains } } });

describe('dashboard profile address', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    [false, 'iksi.app/@ana', '/@ana', 'https://www.iksi.app/@ana'],
    [true, 'ana.iksi.app', 'https://ana.iksi.app/', 'https://ana.iksi.app/']
  ])('subdomains %s: shows %s, links %s, copies %s', async (subdomains, label, href, url) => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const view = show(subdomains);
    const link = view.getByRole('link', { name: label });
    expect(link.getAttribute('href')).toBe(href);
    await fireEvent.click(view.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(url);
    expect(get(toasts).at(-1)).toMatchObject({ message: 'Link copied', variant: 'success' });
  });

  it('gets the flag from the app layout', async () => {
    const parent = async () => ({ user: { id: 1, handle: 'ana' } });
    const args = { parent, route: { id: '/(app)/dashboard' }, cookies: { delete: vi.fn() } };
    expect((await appLayout(args)).subdomains).toBe(false);
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    expect((await appLayout(args)).subdomains).toBe(true);
  });
});

describe('dashboard traffic', () => {
  const withStats = (stats) =>
    render(Page, { props: { data: { user: { id: 1, handle: 'ana', profileId: 3 }, apiKeys: [], streamed: { stats }, subdomains: false } } });

  it('holds the strip with skeletons while the numbers load', () => {
    const view = withStats(new Promise(() => {}));
    expect(view.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(view.getByText('Visits')).toBeInTheDocument();
  });

  it('formats the numbers', async () => {
    const view = withStats(Promise.resolve({ views: 12480, clicks: 1284, ctr: 1284 / 12480 }));
    expect(await view.findByText('12,480')).toBeInTheDocument();
    expect(view.getByText('1,284')).toBeInTheDocument();
    expect(view.getByText('10.3%')).toBeInTheDocument();
  });

  it('says so before anyone has visited', async () => {
    const view = withStats(Promise.resolve({ views: 0, clicks: 0, ctr: 0 }));
    expect(await view.findByText('No visits yet. Share your page to get some.')).toBeInTheDocument();
  });
});

describe('dashboard connected apps', () => {
  it('shows the connected extension in a Connected apps section, keys made by hand below', () => {
    const now = new Date().toISOString();
    const apiKeys = [
      { id: 2, name: 'Chrome extension', prefix: 'iksi_ef56', kind: 'extension', createdAt: now, lastUsedAt: null },
      { id: 1, name: 'Laptop', prefix: 'iksi_ab12', kind: 'manual', createdAt: now, lastUsedAt: null }
    ];
    const view = render(Page, { props: { data: { user: { id: 1, handle: 'ana', profileId: 3 }, apiKeys, streamed: null, subdomains: false } } });
    expect(view.getByRole('heading', { name: 'Connected apps' })).toBeInTheDocument();
    expect(view.queryByRole('heading', { name: 'API keys' })).toBeNull();
    expect(view.getByRole('list', { name: 'Connected apps' })).toHaveTextContent('Chrome extension');
    expect(view.getByText('Connected just now')).toBeInTheDocument();
    expect(view.getByRole('button', { name: 'Disconnect Chrome extension' })).toBeInTheDocument();
    expect(view.getByRole('list', { name: 'API keys' })).toHaveTextContent('Laptop');
  });
});
