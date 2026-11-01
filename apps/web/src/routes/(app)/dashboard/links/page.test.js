import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

import Page from './+page.svelte';

const settings = { destination: 'https://example.com/a', rules: [], expiresAt: null, maxClicks: null, hasPassword: false, permanent: false };
const link = (id, extra = {}) => ({
  id, shortURL: `s${id}`, originalURL: 'https://example.com/a', clickCount: 0, createdAt: new Date().toISOString(),
  safeVerdict: null, profileRow: null, ...extra
});
const renderPage = (links) => render(Page, { props: { data: { user: { handle: null }, links } } });
const gear = () => screen.getByRole('button', { name: 'Link settings' });
const sheet = () => screen.queryByRole('dialog', { name: 'Link settings' });
// Svelte sets inert as a DOM property; browsers reflect it to the attribute, jsdom does not.
const inertPage = () => screen.getByRole('heading', { name: 'Links' }).closest('section').inert === true;

describe('links page settings sheet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not render a toggle for a row without settings', () => {
    renderPage([link(1, { settings }), link(2)]);
    expect(screen.getAllByRole('button', { name: 'Link settings' })).toHaveLength(1);
  });

  it('opens a modal sheet on gear click and moves focus into it', async () => {
    renderPage([link(1, { settings })]);
    expect(sheet()).toBeNull();
    expect(gear()).toHaveAttribute('aria-expanded', 'false');
    expect(inertPage()).toBe(false);
    await fireEvent.click(gear());
    const dialog = sheet();
    // The page behind the sheet is inert while it is open.
    expect(inertPage()).toBe(true);
    expect(dialog.closest('section')).toBeNull();
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('iksi.app/s1')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Destination')).toHaveValue('https://example.com/a');
    expect(gear()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and returns focus to the gear', async () => {
    renderPage([link(1, { settings })]);
    const button = gear();
    await fireEvent.click(button);
    expect(sheet()).toBeInTheDocument();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(sheet()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(inertPage()).toBe(false);
  });

  it('closes on backdrop click and on the close button', async () => {
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    await fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(sheet()).toBeNull();
    await fireEvent.click(gear());
    await fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(sheet()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(gear()));
  });

  it('keeps Tab inside the sheet', async () => {
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    const dialog = sheet();
    const close = within(dialog).getByRole('button', { name: 'Close settings' });
    const addRule = within(dialog).getByRole('button', { name: 'Add rule' });
    // Save is disabled while clean, so Add rule is the last focusable control.
    addRule.focus();
    await fireEvent.keyDown(addRule, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    await fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(addRule);
  });

  it('shows status dots for password, expiry and rules', () => {
    renderPage([link(1, { settings: { ...settings, hasPassword: true, maxClicks: 5 } })]);
    const state = screen.getByRole('list', { name: 'Link state' });
    expect(within(state).getAllByRole('listitem').map((d) => d.textContent.trim())).toEqual([
      'Password on',
      'Expiry on',
      'Rules off'
    ]);
  });

  it('updates the row from the returned settings', async () => {
    const saved = { ...settings, destination: 'https://changed.example.org/b' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, settings: saved }) })));
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: saved.destination } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTitle('https://changed.example.org/b')).toBeInTheDocument());
  });
});
