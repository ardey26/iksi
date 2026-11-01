import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

// The component barrel loads the theme store, which reads localStorage at import.
vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

import Home from './+page.svelte';

afterEach(() => vi.unstubAllGlobals());

describe('home page one-time option', () => {
  it('switches to the one-time form and back', async () => {
    render(Home);
    await fireEvent.click(screen.getByRole('button', { name: 'One-time link' }));
    expect(screen.getByRole('button', { name: 'Create one-time link' })).toBeInTheDocument();
    expect(screen.queryByLabelText('URL to shorten')).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Back to a regular link' }));
    expect(screen.getByLabelText('URL to shorten')).toBeInTheDocument();
  });

  it('shows the new one-time link with a note that it opens once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ shortURL: 'AbCdEfGhJk' }))));
    render(Home);
    await fireEvent.click(screen.getByRole('button', { name: 'One-time link' }));
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com/doc' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(screen.getByText(/AbCdEfGhJk/)).toBeInTheDocument());
    expect(screen.getByText('One-time link. It opens once.')).toBeInTheDocument();
  });
});

describe('home page scoped suggestion', () => {
  const reply = (status, body) => new Response(JSON.stringify(body), { status });

  async function submitTaken(fetchMock) {
    vi.stubGlobal('fetch', fetchMock);
    render(Home);
    await fireEvent.input(screen.getByLabelText('URL to shorten'), { target: { value: 'example.com/sale' } });
    await fireEvent.click(screen.getByText('Want a custom link?'));
    await fireEvent.input(screen.getByLabelText('Custom alias'), { target: { value: 'sale' } });
    await fireEvent.click(screen.getByLabelText('Shorten link'));
  }

  it('offers the scoped name when the name is taken and creates it in one tap', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(409, { error: 'custom link alias already exists, pick another one', suggestion: '@andre/sale' }))
      .mockResolvedValueOnce(reply(200, { shortURL: '@andre/sale' }));
    await submitTaken(fetchMock);

    const use = await screen.findByRole('button', { name: 'Use iksi.app/@andre/sale?' });
    expect(screen.getByText(/That name is taken\./)).toBeInTheDocument();
    await fireEvent.click(use);

    await waitFor(() => expect(screen.getByText(/@andre\/sale/)).toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ longURL: 'example.com/sale', customURL: '@andre/sale' });
    expect(screen.queryByRole('button', { name: /^Use iksi\.app/ })).not.toBeInTheDocument();
  });

  it('drops the offer once the name is edited', async () => {
    await submitTaken(vi.fn().mockResolvedValue(reply(409, { error: 'taken', suggestion: '@andre/sale' })));
    await screen.findByRole('button', { name: 'Use iksi.app/@andre/sale?' });
    await fireEvent.input(screen.getByLabelText('Custom alias'), { target: { value: 'sale2' } });
    expect(screen.queryByRole('button', { name: 'Use iksi.app/@andre/sale?' })).not.toBeInTheDocument();
  });

  it('shows the plain error when there is no offer', async () => {
    await submitTaken(vi.fn().mockResolvedValue(reply(409, { error: 'custom link alias already exists, pick another one' })));
    expect(await screen.findByText('custom link alias already exists, pick another one')).toBeInTheDocument();
  });
});
