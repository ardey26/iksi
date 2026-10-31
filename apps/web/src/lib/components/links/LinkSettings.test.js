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
    const saved = {
      ...base,
      rules: [{ id: 'zzzzzzz1', when: { countries: ['SG'] }, destination: 'https://sg.example.com' }]
    };
    const fetchFn = mockFetch({ body: { ok: true, settings: saved } });
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
    // State now follows the response, not the typed edits.
    await waitFor(() => expect(saveBtn()).toBeDisabled());
    expect(screen.getByLabelText('Countries')).toHaveValue('SG');
    expect(screen.getByRole('button', { name: 'Remove rule 1' })).toBeInTheDocument();
    expect(screen.getByText('1 rule')).toBeInTheDocument();
  });

  it('keeps rule edits after a 400', async () => {
    mockFetch({ status: 400, body: { error: 'Rule 1: destination is not allowed' } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Routing rules/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await fireEvent.input(screen.getByLabelText('Go to'), { target: { value: 'https://x.example.com' } });
    await fireEvent.click(saveBtn());
    expect(await screen.findByText('Rule 1: destination is not allowed')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to')).toHaveValue('https://x.example.com');
  });

  it('emits saved with the returned settings', async () => {
    const saved = { ...base, permanent: true };
    mockFetch({ body: { ok: true, settings: saved } });
    const events = { saved: vi.fn() };
    render(LinkSettings, { props: { id: 7, settings: base }, events });
    await open(/Permanent redirect/);
    await fireEvent.click(screen.getByRole('switch', { name: 'Permanent redirect' }));
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(events.saved).toHaveBeenCalled());
    expect(events.saved.mock.calls[0][0].detail ?? events.saved.mock.calls[0][0]).toEqual(saved);
  });

  it('builds a time condition with days, start, end and zone', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: base } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Routing rules/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    await fireEvent.change(screen.getByLabelText('Add condition'), { target: { value: 'time' } });
    await fireEvent.click(screen.getByLabelText('Fri'));
    await fireEvent.click(screen.getByLabelText('Mon'));
    await fireEvent.input(screen.getByLabelText('Start'), { target: { value: '22:00' } });
    await fireEvent.input(screen.getByLabelText('End'), { target: { value: '06:00' } });
    await fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'UTC' } });
    await fireEvent.input(screen.getByLabelText('Go to'), { target: { value: 'https://night.example.com' } });
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(sent(fetchFn).rules[0].when).toEqual({ time: { days: [1, 5], start: '22:00', end: '06:00', tz: 'UTC' } });
  });

  it('enters an A/B split with a live total', async () => {
    const fetchFn = mockFetch({ body: { ok: true, settings: base } });
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Routing rules/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    const one = screen.getByRole('button', { name: 'One URL' });
    const ab = screen.getByRole('button', { name: 'A/B split' });
    expect(one).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(ab);
    expect(ab).toHaveAttribute('aria-pressed', 'true');
    expect(one).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('radio')).toBeNull();
    await fireEvent.input(screen.getByLabelText('Split destination 1'), { target: { value: 'https://a.example.com' } });
    await fireEvent.input(screen.getByLabelText('Split destination 2'), { target: { value: 'https://b.example.com' } });
    await fireEvent.input(screen.getByLabelText('Split weight 1'), { target: { value: '60' } });
    await fireEvent.input(screen.getByLabelText('Split weight 2'), { target: { value: '30' } });
    expect(screen.getByText(/90 of 100, must add up to 100/)).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Split weight 2'), { target: { value: '40' } });
    expect(screen.getByText('100 of 100')).toBeInTheDocument();
    await fireEvent.click(saveBtn());
    await waitFor(() => expect(fetchFn).toHaveBeenCalled());
    expect(sent(fetchFn).rules[0].split).toEqual([
      { destination: 'https://a.example.com', weight: 60 },
      { destination: 'https://b.example.com', weight: 40 }
    ]);
  });

  it('hints that https:// is added', async () => {
    render(LinkSettings, { props: { id: 7, settings: base } });
    await open(/Destination/);
    expect(screen.getByText('https:// is added if missing')).toBeInTheDocument();
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
