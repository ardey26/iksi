import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

import Page from './+page.svelte';

const settings = { destination: 'https://example.com/a', rules: [], expiresAt: null, maxClicks: null, hasPassword: false, permanent: false };
const link = (id, extra = {}) => ({
  id, shortURL: `s${id}`, originalURL: 'https://example.com/a', clickCount: 0, createdAt: new Date().toISOString(),
  safeVerdict: null, profileRow: null, ...extra
});

describe('links page settings toggle', () => {
  it('does not render a toggle for a row without settings', () => {
    render(Page, { props: { data: { user: { handle: null }, links: [link(1, { settings }), link(2)] } } });
    expect(screen.getAllByRole('button', { name: 'Link settings' })).toHaveLength(1);
  });

  it('updates the row from the returned settings', async () => {
    const saved = { ...settings, destination: 'https://changed.example.org/b' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, settings: saved }) })));
    render(Page, { props: { data: { user: { handle: null }, links: [link(1, { settings })] } } });
    const gear = screen.getByRole('button', { name: 'Link settings' });
    expect(gear).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(gear);
    expect(gear).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: saved.destination } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTitle('https://changed.example.org/b')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
