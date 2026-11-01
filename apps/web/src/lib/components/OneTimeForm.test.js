import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import OneTimeForm from './OneTimeForm.svelte';

function mockFetch(status, body) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
const sent = (fn) => JSON.parse(fn.mock.calls[0][1].body);

afterEach(() => vi.unstubAllGlobals());

describe('OneTimeForm', () => {
  it('starts on URL with a link field and a disabled create button', () => {
    render(OneTimeForm);
    expect(screen.getByRole('radiogroup', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'URL' })).toBeChecked();
    expect(screen.getByLabelText('URL to share once')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create one-time link' })).toBeDisabled();
    expect(screen.getByText(/Unopened links expire in 7 days/)).toBeInTheDocument();
  });

  it('switches to a text field capped at 2,000 characters with a counter', async () => {
    render(OneTimeForm);
    await fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
    const area = screen.getByLabelText('Text to share once');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area).toHaveAttribute('maxlength', '2000');
    expect(screen.getByText('0 / 2,000')).toBeInTheDocument();
    await fireEvent.input(area, { target: { value: 'hello' } });
    expect(screen.getByText('5 / 2,000')).toBeInTheDocument();
  });

  it('posts a text secret and emits the new short link', async () => {
    const fn = mockFetch(200, { shortURL: 'AbCdEfGhJk' });
    const events = { created: vi.fn() };
    render(OneTimeForm, { events });
    await fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
    await fireEvent.input(screen.getByLabelText('Text to share once'), { target: { value: 'door code 4521' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(events.created).toHaveBeenCalled());
    expect(fn.mock.calls[0][0]).toBe('/api/shorten');
    expect(sent(fn)).toEqual({ oneTime: { kind: 'text', content: 'door code 4521' } });
    const arg = events.created.mock.calls[0][0];
    expect(arg.detail ?? arg).toEqual({ shortURL: 'AbCdEfGhJk' });
  });

  it('adds an optional password only when asked', async () => {
    const fn = mockFetch(200, { shortURL: 'AbCdEfGhJk' });
    render(OneTimeForm);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com/doc' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add a password' }));
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'open sesame' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(sent(fn)).toEqual({ oneTime: { kind: 'url', content: 'example.com/doc', password: 'open sesame' } });
  });

  it('shows the server error in the reserved line', async () => {
    mockFetch(400, { error: 'Enter a valid URL' });
    render(OneTimeForm);
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    expect(await screen.findByText('Enter a valid URL')).toBeInTheDocument();
  });
});
