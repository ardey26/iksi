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
  it('renders a canvas and a Download PNG button for a valid link', async () => {
    const { container } = render(QrPage);
    expect(container.querySelector('canvas')).toBeNull();
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('canvas')).not.toBeNull());
    expect(qr.toCanvas.mock.calls[0][1]).toBe('https://example.com');
    expect(screen.getByRole('link', { name: 'Download PNG' })).toBeTruthy();
  });

  it('shows an error and no canvas for an invalid link', async () => {
    const { container } = render(QrPage);
    await submit('not a url');
    expect(container.querySelector('canvas')).toBeNull();
    expect(qr.toCanvas).not.toHaveBeenCalled();
    expect(container.querySelector('[id$="-error"]').textContent).toMatch(/valid link/i);
    expect(screen.queryByRole('link', { name: 'Download PNG' })).toBeNull();
  });

  it('keeps the canvas box the same size before and after generation', async () => {
    const { container } = render(QrPage);
    const box = container.querySelector('[data-qr-box]');
    const before = box.getAttribute('style');
    expect(before).toMatch(/width/);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('canvas')).not.toBeNull());
    expect(box.getAttribute('style')).toBe(before);
    expect(container.querySelector('canvas').getAttribute('style')).toMatch(/width:\s*100%/);
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
    await waitFor(() => expect(container.querySelector('canvas')).not.toBeNull());
    expect(qr.toCanvas.mock.calls[0][1]).toBe(v.startsWith('http') ? v : 'https://' + v);
  });

  it('shows an error and resets when generation throws', async () => {
    qr.toCanvas.mockRejectedValue(new Error('data too big'));
    const { container } = render(QrPage);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('[id$="-error"]').textContent).toMatch(/too long/i));
    expect(container.querySelector('canvas')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Download PNG' })).toBeNull();
  });
});
