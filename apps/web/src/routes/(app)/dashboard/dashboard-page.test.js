import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
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
  });

  it('gets the flag from the app layout', async () => {
    const parent = async () => ({ user: { id: 1, handle: 'ana' } });
    const args = { parent, route: { id: '/(app)/dashboard' }, cookies: { delete: vi.fn() } };
    expect((await appLayout(args)).subdomains).toBe(false);
    vi.stubEnv('SUBDOMAINS_ENABLED', 'true');
    expect((await appLayout(args)).subdomains).toBe(true);
  });
});
