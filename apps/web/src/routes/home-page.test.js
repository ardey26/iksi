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
