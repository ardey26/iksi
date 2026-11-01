import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

import { get } from 'svelte/store';
import { toasts, dismiss } from '#lib/ui/toast.js';
import Page from './+page.svelte';

const toastText = () => get(toasts).map((t) => t.message);
afterEach(() => get(toasts).forEach((t) => dismiss(t.id)));

const settings = { destination: 'https://example.com/a', rules: [], expiresAt: null, maxClicks: null, hasPassword: false, permanent: false };
const link = (id, extra = {}) => ({
  id, shortURL: `s${id}`, originalURL: 'https://example.com/a', clickCount: 0, createdAt: new Date().toISOString(),
  safeVerdict: null, profileRow: null, ...extra
});
const renderPage = (links) => render(Page, { props: { data: { user: { handle: null }, links } } });
const gear = (n = 1) => screen.getByRole('button', { name: `Settings for iksi.app/s${n}` });
const sheet = () => screen.queryByRole('dialog', { name: 'Link settings' });
// Svelte sets inert as a DOM property; browsers reflect it to the attribute, jsdom does not.
const inertPage = () => screen.getByRole('heading', { name: 'Links' }).closest('[data-page]').inert === true;
const rowOf = (text) => screen.getByText(text).closest('li');

describe('links page settings sheet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not open settings for a row without settings', () => {
    renderPage([link(1, { settings }), link(2)]);
    expect(gear(1)).toBeEnabled();
    expect(gear(2)).toBeDisabled();
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
    expect(dialog.closest('[data-page]')).toBeNull();
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('iksi.app/s1')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Title on your page')).toHaveValue('');
    expect(within(dialog).getByLabelText('Destination')).toHaveValue('https://example.com/a');
    expect(gear()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and returns focus to the gear', async () => {
    renderPage([link(1, { settings })]);
    const button = gear();
    await fireEvent.click(button);
    expect(sheet()).toBeInTheDocument();
    await fireEvent.keyDown(sheet(), { key: 'Escape' });
    expect(sheet()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(inertPage()).toBe(false);
  });

  it('closes on backdrop click and on the close button', async () => {
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    await fireEvent.click(document.querySelector('.scrim'));
    expect(sheet()).toBeNull();
    await fireEvent.click(gear());
    await fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(sheet()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(gear()));
  });

  it('keeps Tab inside the sheet', async () => {
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    const dialog = sheet();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    // Save is disabled while clean, so Cancel is the last focusable control.
    cancel.focus();
    await fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    await fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it('shows badges for the settings that are on', () => {
    renderPage([link(1, { settings: { ...settings, hasPassword: true, maxClicks: 5 } })]);
    const state = screen.getByRole('list', { name: 'Link state' });
    expect(within(state).getAllByRole('listitem').map((d) => d.textContent.trim())).toEqual(['Password', 'Expiry']);
  });

  it('updates the row from the returned settings', async () => {
    const saved = { ...settings, destination: 'https://changed.example.org/b' };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, settings: saved }) })));
    renderPage([link(1, { settings })]);
    await fireEvent.click(gear());
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: saved.destination } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTitle('https://changed.example.org/b')).toBeInTheDocument());
    expect(screen.getByTitle('https://changed.example.org/b')).toHaveTextContent('changed.example.org/b');
    expect(toastText()).toContain('Settings saved');
  });
});

describe('links page one-time links', () => {
  afterEach(() => vi.unstubAllGlobals());
  const oneTime = (id, kind, state) =>
    link(id, { shortURL: `OneTime${id}`, originalURL: '', oneTime: { kind, state } });

  it('shows a one-time row by kind and state, without settings or an on-page switch', () => {
    renderPage([link(1, { settings }), oneTime(2, 'text', 'unopened')]);
    const row = rowOf('iksi.app/OneTime2');
    expect(within(row).getByText('One-time text')).toBeInTheDocument();
    expect(within(row).getByText('Unopened')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Settings for/ })).toBeNull();
    expect(within(row).queryByRole('switch')).toBeNull();
    expect(within(row).getByRole('button', { name: 'Delete iksi.app/OneTime2' })).toBeInTheDocument();
  });

  it.each([
    ['url', 'opened', 'One-time URL', 'Opened'],
    ['text', 'expired', 'One-time text', 'Expired']
  ])('a %s link that is %s says so', (kind, state, title, label) => {
    renderPage([oneTime(3, kind, state)]);
    const row = rowOf('iksi.app/OneTime3');
    expect(within(row).getByText(title)).toBeInTheDocument();
    expect(within(row).getByText(label)).toBeInTheDocument();
  });

  it('offers the one-time create form and adds the new row to the top', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      shortURL: 'NewOne1234',
      link: { id: 50, shortURL: 'NewOne1234', originalURL: '', clickCount: 0, createdAt: new Date().toISOString(), safeVerdict: null, oneTime: { kind: 'url', state: 'unopened' } }
    }))));
    renderPage([link(1, { settings })]);
    await fireEvent.input(screen.getByLabelText('Link to share'), { target: { value: 'example.com/doc' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(screen.getByText('iksi.app/NewOne1234')).toBeInTheDocument());
    const rows = within(screen.getByRole('list', { name: 'One-time links' })).getAllByRole('listitem');
    expect(within(rows[0]).getByText('iksi.app/NewOne1234')).toBeInTheDocument();
    expect(toastText()).toContain('One-time link created');
  });
});

describe('links page custom names', () => {
  afterEach(() => vi.unstubAllGlobals());

  const reply = (status, body) => new Response(JSON.stringify(body), { status });
  const created = (shortURL) =>
    reply(200, { shortURL, link: { id: 50, shortURL, originalURL: 'https://example.com/sale', clickCount: 0, createdAt: new Date().toISOString(), safeVerdict: null } });
  const renderAs = (extra = {}) =>
    render(Page, { props: { data: { user: { handle: 'andre' }, links: [], ...extra } } });

  async function addNamed(name) {
    await fireEvent.input(screen.getByLabelText('Long URL'), { target: { value: 'example.com/sale' } });
    await fireEvent.input(screen.getByLabelText(/^Custom name/), { target: { value: name } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
  }
  const sent = (fetchMock, i) => JSON.parse(fetchMock.mock.calls[i][1].body);

  it('shows a scoped link with its full path', () => {
    renderPage([link(1, { shortURL: '@andre/sale' })]);
    expect(screen.getByText('iksi.app/@andre/sale')).toBeInTheDocument();
  });

  it('sends the custom name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(created('sale'));
    vi.stubGlobal('fetch', fetchMock);
    renderAs();
    await addNamed('sale');
    await waitFor(() => expect(screen.getByText('iksi.app/sale')).toBeInTheDocument());
    expect(sent(fetchMock, 0)).toEqual({ longURL: 'example.com/sale', customURL: 'sale' });
  });

  it('prefixes the name with the handle when names go under it', () => {
    renderAs({ scopeCustomNames: true });
    expect(screen.getByText('iksi.app/@andre/')).toBeInTheDocument();
    renderAs();
    expect(screen.getByText('iksi.app/')).toBeInTheDocument();
  });

  it('offers the scoped name for a taken one and creates it in one tap', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(409, { error: 'custom link alias already exists, pick another one', suggestion: '@andre/sale' }))
      .mockResolvedValueOnce(created('@andre/sale'))
      // Putting the new link on the page.
      .mockResolvedValue(reply(200, { ok: true, row: { id: 3, title: 'example.com', enabled: true, position: 0 } }));
    vi.stubGlobal('fetch', fetchMock);
    renderAs();
    await addNamed('sale');

    const use = await screen.findByRole('button', { name: 'Use iksi.app/@andre/sale?' });
    expect(screen.getByText('That name is taken.')).toBeInTheDocument();
    await fireEvent.click(use);

    await waitFor(() => expect(screen.getByText('iksi.app/@andre/sale')).toBeInTheDocument());
    expect(sent(fetchMock, 1)).toEqual({ longURL: 'example.com/sale', customURL: '@andre/sale' });
    expect(screen.queryByRole('button', { name: /^Use iksi\.app/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Custom name/)).toHaveValue('');
  });

  it('drops the offer once the name is edited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(409, { error: 'taken', suggestion: '@andre/sale' })));
    renderAs();
    await addNamed('sale');
    await screen.findByRole('button', { name: 'Use iksi.app/@andre/sale?' });
    await fireEvent.input(screen.getByLabelText(/^Custom name/), { target: { value: 'sale2' } });
    expect(screen.queryByRole('button', { name: 'Use iksi.app/@andre/sale?' })).not.toBeInTheDocument();
  });
});

describe('links page groups and order', () => {
  afterEach(() => vi.unstubAllGlobals());
  const row = (id, title, position) => ({ id: 100 + id, title, enabled: true, position });
  const onPage = (id, title, position) => link(id, { settings, profileRow: row(id, title, position) });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  const listNamed = (name) => screen.getByRole('list', { name });
  const titles = (name) => within(listNamed(name)).getAllByRole('listitem').map((li) => li.querySelector('.clip').textContent);

  it('splits the page links from the rest and shows each fact on its own line', () => {
    renderPage([onPage(1, 'Shop', 0), onPage(2, 'Blog', 1), link(3, { settings, clickCount: 12480 })]);
    expect(titles('On your page')).toEqual(['Shop', 'Blog']);
    expect(titles('Other links')).toEqual(['iksi.app/s3']);
    const other = rowOf('iksi.app/s3');
    expect(within(other).getByText('example.com/a')).toHaveAttribute('title', 'https://example.com/a');
    expect(within(other).getByText('12,480')).toBeInTheDocument();
    expect(within(other).getByText('Just now')).toBeInTheDocument();
  });

  it('saves the page order after a reorder on the grip', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage([onPage(1, 'Shop', 0), onPage(2, 'Blog', 1), onPage(3, 'Docs', 2)]);
    const grip = screen.getByRole('button', { name: 'Reorder Docs' });
    grip.focus();
    await fireEvent.keyDown(grip, { key: 'Enter' });
    await fireEvent.keyDown(grip, { key: 'ArrowUp' });
    await fireEvent.keyDown(grip, { key: 'ArrowUp' });
    await fireEvent.keyDown(grip, { key: 'Enter' });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/dashboard/profile');
    expect(JSON.parse(init.body)).toEqual({ action: 'reorderRows', orderedIds: [103, 101, 102] });
    expect(titles('On your page')).toEqual(['Docs', 'Shop', 'Blog']);
    await waitFor(() => expect(toastText()).toContain('Order saved'));
  });

  it('reloads the order when saving it fails', async () => {
    const { invalidateAll } = await import('$app/navigation');
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'nope' }, 500)));
    renderPage([onPage(1, 'Shop', 0), onPage(2, 'Blog', 1)]);
    const grip = screen.getByRole('button', { name: 'Reorder Blog' });
    grip.focus();
    await fireEvent.keyDown(grip, { key: ' ' });
    await fireEvent.keyDown(grip, { key: 'ArrowUp' });
    await fireEvent.keyDown(grip, { key: ' ' });
    await waitFor(() => expect(toastText()).toContain('Could not save the order'));
    expect(invalidateAll).toHaveBeenCalled();
  });

  it('moves a link onto the page with its switch and keeps focus on it', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, row: row(2, 'example.com', 1) }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage([onPage(1, 'Shop', 0), link(2, { settings })]);
    await fireEvent.click(screen.getByRole('switch', { name: 'Show iksi.app/s2 on your page' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'upsertRow', linkId: 2, title: 'example.com', enabled: true });
    await waitFor(() => expect(titles('On your page')).toEqual(['Shop', 'example.com']));
    const moved = screen.getByRole('switch', { name: 'Show iksi.app/s2 on your page' });
    expect(moved).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(document.activeElement).toBe(moved));
  });

  it('saves a page title from the sheet', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, row: row(1, 'My shop', 0) }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage([onPage(1, 'Shop', 0)]);
    await fireEvent.click(gear());
    await fireEvent.input(screen.getByLabelText('Title on your page'), { target: { value: 'My shop' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'upsertRow', linkId: 1, title: 'My shop', enabled: true });
    await waitFor(() => expect(titles('On your page')).toEqual(['My shop']));
  });

  it('deletes a link from the sheet after confirming', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage([link(1, { settings }), link(2, { settings })]);
    await fireEvent.click(gear());
    await fireEvent.click(screen.getByRole('button', { name: 'Delete link' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/dashboard/links', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ id: 1 }) })));
    expect(screen.queryByText('iksi.app/s1')).toBeNull();
    expect(sheet()).toBeNull();
    await waitFor(() => expect(toastText()).toContain('Link deleted'));
  });

  it('confirms a one-time delete inline', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderPage([link(5, { shortURL: 'OneTime5', originalURL: '', oneTime: { kind: 'url', state: 'opened' } })]);
    await fireEvent.click(screen.getByRole('button', { name: 'Delete iksi.app/OneTime5' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete iksi.app/OneTime5' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('iksi.app/OneTime5')).toBeNull());
  });

  it('has an empty state for no links and for an empty page', () => {
    const first = renderPage([]);
    expect(screen.getByText('No links yet')).toBeInTheDocument();
    first.unmount();
    renderPage([link(1, { settings })]);
    expect(screen.getByText('Nothing on your page yet')).toBeInTheDocument();
  });
});
