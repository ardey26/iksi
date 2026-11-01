import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

const invalidateAll = vi.fn();
vi.mock('$app/navigation', () => ({ invalidateAll: (...a) => invalidateAll(...a) }));

import Page from './+page.svelte';

const OLD = 'https://cdn.test/old.webp';
const NEW = 'https://cdn.test/new.webp';

function data(avatarUrl = OLD) {
  return {
    user: { id: 1, handle: 'me', twitterHandle: null, googleEmail: 'me@x.com' },
    profile: { displayName: 'Me', bio: '', avatarUrl, backgroundUrl: null, theme: '20', accent: '#3B82F6', publicClicks: false }
  };
}
const save = () => screen.getByRole('button', { name: /save changes|saved|saving/i });
const pick = (container) =>
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] }
  });

describe('profile editor payments', () => {
  it('shows the Payments section with the stored methods', () => {
    const d = {
      ...data(),
      payments: { methods: [{ id: 'l1', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/me' }], label: 'tip' }
    };
    render(Page, { props: { data: d } });
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByText('https://ko-fi.com/me')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Send a tip' })).toBeChecked();
  });

  it('warns that a QR may show the mobile number to payers', () => {
    render(Page, { props: { data: { ...data(), payments: { methods: [], label: 'pay' } } } });
    expect(screen.getByText('Your QR may include your mobile number. Anyone who opens Pay can see it.')).toBeInTheDocument();
  });
});

describe('profile editor upload sync', () => {
  let fetchMock;
  beforeEach(() => {
    invalidateAll.mockReset().mockResolvedValue(undefined);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('upload sets avatarUrl, leaves form clean, and Save later submits the CDN url', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ url: NEW }) });
    const { container } = render(Page, { props: { data: data() } });
    await pick(container);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', NEW));
    expect(save()).toBeDisabled();

    // Make the form dirty via another field, then save.
    await fireEvent.input(screen.getByDisplayValue('Me'), { target: { value: 'New name' } });
    expect(save()).not.toBeDisabled();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, avatarUrl: NEW }) });
    await fireEvent.click(save());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.avatarUrl).toBe(NEW);
  });

  it('stays clean when invalidateAll rejects after an upload', async () => {
    invalidateAll.mockRejectedValue(new Error('offline'));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ url: NEW }) });
    const { container } = render(Page, { props: { data: data() } });
    await pick(container);
    await waitFor(() => expect(invalidateAll).toHaveBeenCalled());
    expect(save()).toBeDisabled();
  });

  it('Remove of the saved image leaves the form clean', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204 });
    const { container } = render(Page, { props: { data: data() } });
    await fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await waitFor(() => expect(container.querySelector('img[src="' + OLD + '"]')).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/api/media?kind=avatar', { method: 'DELETE' });
    expect(save()).toBeDisabled();
  });

  it('Remove of an unsaved typed URL does not call the server and is dirty', async () => {
    const { container } = render(Page, { props: { data: data('') } });
    await fireEvent.click(screen.getByText('Paste a URL instead'));
    await fireEvent.input(screen.getByLabelText('Avatar URL'), { target: { value: 'https://typed.test/a.png' } });
    expect(save()).not.toBeDisabled();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Avatar URL')).toHaveValue('');
    expect(save()).toBeDisabled(); // back to the saved (empty) baseline
  });
});
