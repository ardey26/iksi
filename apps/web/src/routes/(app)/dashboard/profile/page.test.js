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
    expect(screen.getByText('ko-fi.com/me')).toBeInTheDocument();
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

describe('use my handle for custom names', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const toggle = () => screen.getByRole('switch', { name: 'Use my handle for custom names' });

  it('is a setting row, off by default, reading out the address a custom name gets', () => {
    render(Page, { props: { data: data() } });
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(toggle()).toHaveAccessibleDescription(/New custom names go under iksi\.app\/@me/);
    expect(screen.getByText('iksi.app/name')).toBeInTheDocument();
  });

  it('shows the stored value', () => {
    render(Page, { props: { data: { ...data(), scopeCustomNames: true } } });
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('iksi.app/@me/name')).toBeInTheDocument();
  });

  it('saves right away', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, on: true })));
    render(Page, { props: { data: data() } });
    await fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/dashboard/profile');
    expect(JSON.parse(init.body)).toEqual({ action: 'setScopeCustomNames', on: true });
  });

  it('goes back when the save fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    render(Page, { props: { data: data() } });
    await fireEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('Could not save. Try again.')).toBeInTheDocument();
  });
});

describe('profile editor save', () => {
  let fetchMock;
  beforeEach(() => {
    invalidateAll.mockReset().mockResolvedValue(undefined);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('says when there are unsaved changes and toasts a failed save', async () => {
    const { get } = await import('svelte/store');
    const { toasts } = await import('#lib/ui/toast.js');
    render(Page, { props: { data: data() } });
    expect(screen.getByText('Identity and appearance save together.')).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText('Display name'), { target: { value: 'Other' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Name is too long' }) });
    await fireEvent.click(save());
    await waitFor(() => expect(get(toasts).map((t) => t.message)).toContain('Name is too long'));
    expect(save()).not.toBeDisabled();
  });
});

describe('profile editor accent', () => {
  it('does not count the color input lowercasing the accent as a change', async () => {
    render(Page, { props: { data: data() } });
    await fireEvent.input(screen.getByLabelText('Accent color'), { target: { value: '#3b82f6' } });
    expect(save()).toBeDisabled();
    await fireEvent.input(screen.getByLabelText('Accent color'), { target: { value: '#ff0000' } });
    expect(save()).not.toBeDisabled();
  });
});
