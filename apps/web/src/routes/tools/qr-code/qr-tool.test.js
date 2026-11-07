import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

const qr = vi.hoisted(() => ({ toCanvas: vi.fn(), toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ default: qr }));

import QrPage from './+page.svelte';
import { marketingPage } from '#lib/marketing/pages.js';

beforeEach(() => {
  qr.toCanvas.mockReset().mockResolvedValue(undefined);
  qr.toDataURL.mockReset().mockResolvedValue('data:image/png;base64,AAAA');
});
afterEach(cleanup);

const submit = async (value) => {
  await fireEvent.input(screen.getByLabelText('Link'), { target: { value } });
  await fireEvent.click(screen.getByRole('button', { name: 'Make QR code' }));
};

describe('/tools/qr-code', () => {
  it('shows nothing below the button until a code exists', () => {
    const { container } = render(QrPage);
    // No empty placeholder box either: the old reserved white square.
    expect(container.querySelector('[data-qr-frame], [data-qr-box]')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Download PNG' })).toBeNull();
  });

  it('shows the code as an image in a white frame, with Download PNG, for a valid link', async () => {
    const { container } = render(QrPage);
    await submit('example.com');
    const img = await waitFor(() => {
      const el = container.querySelector('[data-qr-frame] img');
      expect(el).not.toBeNull();
      return el;
    });
    expect(qr.toDataURL.mock.calls[0][0]).toBe('https://example.com');
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(img.getAttribute('alt')).toBe('QR code for https://example.com');
    expect(screen.getByRole('link', { name: 'Download PNG' })).toBeTruthy();
  });

  // A canvas sized by the library overflowed its box and cropped the code.
  it('renders one image, never a canvas the library can resize', async () => {
    const { container } = render(QrPage);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('[data-qr-frame] img')).not.toBeNull());
    expect(container.querySelector('canvas')).toBeNull();
    expect(qr.toCanvas).not.toHaveBeenCalled();
    expect(qr.toDataURL).toHaveBeenCalledTimes(1);
  });

  it('shows an error and no code for an invalid link', async () => {
    const { container } = render(QrPage);
    await submit('not a url');
    expect(container.querySelector('[data-qr-frame]')).toBeNull();
    expect(qr.toDataURL).not.toHaveBeenCalled();
    expect(container.querySelector('[id$="-error"]').textContent).toMatch(/valid link/i);
    expect(screen.queryByRole('link', { name: 'Download PNG' })).toBeNull();
  });

  it('downloads iksi-qr.png from toDataURL', async () => {
    render(QrPage);
    await submit('example.com');
    const a = await screen.findByRole('link', { name: 'Download PNG' });
    await waitFor(() => expect(a.getAttribute('href')).toBe('data:image/png;base64,AAAA'));
    expect(a.getAttribute('download')).toBe('iksi-qr.png');
  });

  it('offers a short link first, linking to /', () => {
    render(QrPage);
    const link = screen.getByRole('link', { name: /shorten/i });
    expect(link.getAttribute('href')).toBe('/');
    expect(document.body.textContent).toMatch(/destination/i);
  });

  // Links shortened signed out have no owner, so nobody can change them.
  it('says a destination can change only on a link shortened while signed in', () => {
    render(QrPage);
    const text = document.body.textContent;
    expect(text).not.toMatch(/A short link's destination can also be changed later/);
    expect(text).toContain('Sign in before you shorten and you can change the destination later');
  });

  it('styles every inline link as a text link', () => {
    const { container } = render(QrPage);
    const links = [...container.querySelectorAll('p a')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.classList.contains('text-link'), a.textContent).toBe(true);
  });

  it('is registered with an FAQ', () => {
    const p = marketingPage('/tools/qr-code');
    expect(p.kind).toBe('tool');
    expect(JSON.stringify(p.structuredData())).toContain('FAQPage');
    render(QrPage);
    expect(screen.getByText('Do QR codes expire?')).toBeTruthy();
  });

  it.each(['iksi.app/abc', 'https://www.iksi.app/abc'])('accepts iksi link %s', async (v) => {
    const { container } = render(QrPage);
    await submit(v);
    await waitFor(() => expect(container.querySelector('[data-qr-frame] img')).not.toBeNull());
    expect(qr.toDataURL.mock.calls[0][0]).toBe(v.startsWith('http') ? v : 'https://' + v);
  });

  it('shows an error and resets when generation throws', async () => {
    qr.toDataURL.mockRejectedValue(new Error('data too big'));
    const { container } = render(QrPage);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('[id$="-error"]').textContent).toMatch(/too long/i));
    expect(container.querySelector('[data-qr-frame]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Download PNG' })).toBeNull();
  });
});
