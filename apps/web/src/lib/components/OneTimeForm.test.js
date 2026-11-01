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
    // URL or Text is chosen in the page's mode row, not inside the form.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByLabelText('URL to share once')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create one-time link' })).toBeDisabled();
    expect(screen.getByText(/Unopened links expire in 7 days/)).toBeInTheDocument();
  });

  it('switches to a text field capped at 2,000 characters with a counter', async () => {
    const { rerender } = render(OneTimeForm);
    await rerender({ kind: 'text' });
    expect(screen.queryByLabelText('URL to share once')).not.toBeInTheDocument();
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
    render(OneTimeForm, { props: { kind: 'text' }, events });
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

  it('opens the password under the button row, keeping the toggle in place', async () => {
    const { container } = render(OneTimeForm);
    const toggle = screen.getByRole('button', { name: 'Add a password' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(toggle);
    // Same button, still there: it is the control that closes it again.
    expect(screen.getByRole('button', { name: 'Add a password' })).toBe(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const password = screen.getByLabelText('Password');
    const url = screen.getByLabelText('URL to share once');
    const create = screen.getByRole('button', { name: 'Create one-time link' });
    // Field, then the toggle, then the password: what opens comes after
    // everything the user was looking at, so none of it moves.
    expect(url.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(password.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('.note').compareDocumentPosition(password) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('drops the password when the toggle closes it', async () => {
    const fn = mockFetch(200, { shortURL: 'AbCdEfGhJk' });
    render(OneTimeForm);
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com/doc' } });
    const toggle = screen.getByRole('button', { name: 'Add a password' });
    await fireEvent.click(toggle);
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'open sesame' } });
    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(fn).toHaveBeenCalled());
    expect(sent(fn)).toEqual({ oneTime: { kind: 'url', content: 'example.com/doc' } });
  });

  it('shows the server error in the reserved line', async () => {
    mockFetch(400, { error: 'Enter a valid URL' });
    render(OneTimeForm);
    await fireEvent.input(screen.getByLabelText('URL to share once'), { target: { value: 'example.com' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    expect(await screen.findByText('Enter a valid URL')).toBeInTheDocument();
  });
});
