import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ImageUpload from './ImageUpload.svelte';

function fileOf(size, type = 'image/png', name = 'a.png') {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function pick(container, file) {
  const input = container.querySelector('input[type="file"]');
  return fireEvent.change(input, { target: { files: [file] } });
}

describe('ImageUpload', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects files over 4 MB without calling fetch', async () => {
    const { container } = render(ImageUpload, { props: { kind: 'avatar', value: null } });
    await pick(container, fileOf(5 * 1024 * 1024));
    expect(await screen.findByText('Images must be under 4 MB.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads a valid file, shows the new url and dispatches change', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url: 'https://cdn.test/new.png' }) });
    const onChange = vi.fn();
    const { container } = render(ImageUpload, { props: { kind: 'avatar', value: null }, events: { change: onChange } });
    await pick(container, fileOf(1000));
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/new.png'));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/media');
    expect(init.method).toBe('POST');
    expect(init.body.get('kind')).toBe('avatar');
    expect(init.body.get('file')).toBeInstanceOf(File);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].detail).toEqual({ url: 'https://cdn.test/new.png' });
  });

  it('shows the server error and keeps the old preview on 400', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Unsupported image type.', code: 'unsupported' }) });
    const { container } = render(ImageUpload, { props: { kind: 'avatar', value: 'https://cdn.test/old.png' } });
    await pick(container, fileOf(1000));
    expect(await screen.findByText('Unsupported image type.')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/old.png');
  });

  it('Remove sends DELETE and dispatches change with null', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    const onChange = vi.fn();
    const { container } = render(ImageUpload, { props: { kind: 'avatar', value: 'https://cdn.test/old.png' }, events: { change: onChange } });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/media?kind=avatar', { method: 'DELETE' });
    expect(onChange.mock.calls[0][0].detail).toEqual({ url: null });
    expect(container.querySelector('img')).toBeNull();
  });
});
