import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LinkSettings from './LinkSettings.svelte';

const base = {
  destination: 'https://example.com/start',
  rules: [],
  expiresAt: null,
  maxClicks: null,
  hasPassword: false,
  permanent: false
};

function mockFetch(response) {
  const fn = vi.fn(async () => ({
    ok: response.status === undefined || response.status < 400,
    status: response.status ?? 200,
    json: async () => response.body
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const sent = (fn) => JSON.parse(fn.mock.calls[0][1].body);
const saveBtn = () => screen.getByRole('button', { name: 'Save' });
const open = (name) => fireEvent.click(screen.getByRole('button', { name }));

describe('LinkSettings', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('starts collapsed and shows the destination once opened', async () => {
    render(LinkSettings, { props: { id: 7, settings: base } });
    expect(screen.queryByLabelText('Destination')).toBeNull();
    await open(/Destination/);
    expect(screen.getByLabelText('Destination')).toHaveValue('https://example.com/start');
  });

  it('keeps Save disabled with no changes', async () => {
    render(LinkSettings, { props: { id: 7, settings: base } });
    expect(saveBtn()).toBeDisabled();
    await open(/Destination/);
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: 'https://example.com/new' } });
    expect(saveBtn()).toBeEnabled();
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: base.destination } });
    expect(saveBtn()).toBeDisabled();
  });

  it('saves a country rule', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: base } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Routing rules/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await fireEvent.change(screen.getByLabelText('Add condition'), { target: { value: 'country' } });
    await fireEvent.input(screen.getByLabelText('Countries'), { target: { value: 'sg' } });
    await fireEvent.input(screen.getByLabelText('Go to'), { target: { value: 'https://sg.example.com' } });
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(fetchFn.mock.calls[0][0]).toBe('/dashboard/links');
    expect(fetchFn.mock.calls[0][1].method).toBe('PATCH');
    expect(sent(fetchFn)).toEqual({
      id: 7,
      rules: [{ id: expect.stringMatching(/^[A-Za-z0-9_-]{8}$/), when: { countries: ['SG'] }, destination: 'https://sg.example.com' }]
    });
  });

  it('shows the server error and keeps the edits', async () => {
    mockFetch({ status: 400, body: { error: 'Rule 1: weights must add up to 100' } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Destination/);
    await fireEvent.input(screen.getByLabelText('Destination'), { target: { value: 'https://example.com/new' } });
    await fireEvent.click(saveBtn());
    expect(await screen.findByText('Rule 1: weights must add up to 100')).toBeInTheDocument();
    expect(screen.getByLabelText('Destination')).toHaveValue('https://example.com/new');
    expect(saveBtn()).toBeEnabled();
  });

  it('shows a rule error without calling the server', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: base } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Routing rules/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await fireEvent.click(saveBtn());
    expect(await screen.findByText('Rule 1: add a destination')).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('removes a password', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: { ...base, hasPassword: false } } });
    render(LinkSettings, { props: { id: 7, settings: { ...base, hasPassword: true } } });
    await open(/Password/);
    expect(screen.getByText('Password set')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove password' }));
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(sent(fetchFn)).toEqual({ id: 7, password: null });
  });

  it('sets a password and max clicks', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: base } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Password/);
    await fireEvent.input(screen.getByLabelText('New password'), { target: { value: 'hunter22' } });
    await open(/Expiry/);
    await fireEvent.input(screen.getByLabelText('Max clicks'), { target: { value: '50' } });
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(sent(fetchFn)).toEqual({ id: 7, password: 'hunter22', maxClicks: 50 });
  });

  it('sends permanent and resets the baseline after saving', async () => {
    const saved = { ...base, permanent: true };
    const fetchFn = mockFetch({ body: { ok: true, settings: saved } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Permanent redirect/);
    expect(screen.getByText(/Browsers cache 301s/)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('switch', { name: 'Permanent redirect' }));
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(sent(fetchFn)).toEqual({ id: 7, permanent: true });
    await waitFor(() => expect(saveBtn()).toBeDisabled());
  });
});
