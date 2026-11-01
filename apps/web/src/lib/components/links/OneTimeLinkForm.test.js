import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import OneTimeLinkForm from './OneTimeLinkForm.svelte';

const created = {
  shortURL: 'AbCdEfGhJk',
  link: { id: 9, shortURL: 'AbCdEfGhJk', originalURL: '', clickCount: 0, createdAt: '2026-11-01T00:00:00.000Z', safeVerdict: null, oneTime: { kind: 'text', state: 'unopened' } }
};

function mockFetch(status, body) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('OneTimeLinkForm (dashboard)', () => {
  it('is a spec-sheet section with a content switch, a field, a password and a create button', () => {
    render(OneTimeLinkForm);
    expect(screen.getByRole('heading', { name: 'One-time link' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Content' })).toBeInTheDocument();
    expect(screen.getByLabelText('Link to share')).toHaveClass('d-field');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Create one-time link' })).toBeDisabled();
  });

  it('a text secret has a 2,000 character limit and counter', async () => {
    render(OneTimeLinkForm);
    await fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
    const area = screen.getByLabelText('Message');
    expect(area).toHaveAttribute('maxlength', '2000');
    await fireEvent.input(area, { target: { value: 'abc' } });
    expect(screen.getByText('3 / 2,000')).toBeInTheDocument();
  });

  it('creates the link, clears the form and emits the new row', async () => {
    const fn = mockFetch(200, created);
    const events = { created: vi.fn() };
    render(OneTimeLinkForm, { events });
    await fireEvent.click(screen.getByRole('radio', { name: 'Text' }));
    await fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'door code 4521' } });
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'open sesame' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    await waitFor(() => expect(events.created).toHaveBeenCalled());
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({
      oneTime: { kind: 'text', content: 'door code 4521', password: 'open sesame' }
    });
    const arg = events.created.mock.calls[0][0];
    expect(arg.detail ?? arg).toEqual(created.link);
    expect(screen.getByLabelText('Message')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('shows the server error and keeps what was typed', async () => {
    mockFetch(400, { error: 'Enter a valid URL' });
    render(OneTimeLinkForm);
    await fireEvent.input(screen.getByLabelText('Link to share'), { target: { value: 'example.com' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create one-time link' }));
    expect(await screen.findByText('Enter a valid URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Link to share')).toHaveValue('example.com');
  });
});
