import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const toDataURL = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toDataURL } }));

import PayButton from './PayButton.svelte';

const PAYLOAD = '00020101021127...6304ABCD';
// What the page gets: no payload. The sheet fetches it when opened.
const qr = {
  id: 'q1',
  kind: 'qr',
  provider: null,
  name: 'JUAN DELA CRUZ',
  city: 'MANDALUYONG',
  country: 'PH',
  currency: 'PHP'
};
const paypal = { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' };
const props = (over = {}) => ({ handle: 'ann', displayName: 'Ann', label: 'pay', methods: [qr, paypal], ...over });

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
let fetchMock;

beforeEach(() => {
  toDataURL.mockReset().mockResolvedValue(PNG);
  fetchMock = vi.fn(async () => ok({ payloads: { q1: PAYLOAD } }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('PayButton', () => {
  it('is labelled Pay or Send a tip', () => {
    const { unmount } = render(PayButton, { props: props() });
    expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument();
    unmount();
    render(PayButton, { props: props({ label: 'tip' }) });
    expect(screen.getByRole('button', { name: 'Send a tip' })).toBeInTheDocument();
  });

  it('opens a sheet that takes focus', async () => {
    render(PayButton, { props: props() });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const dialog = screen.getByRole('dialog', { name: 'Pay Ann' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('titles a tip sheet as a tip', async () => {
    render(PayButton, { props: props({ label: 'tip' }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Send a tip' }));
    expect(screen.getByRole('dialog', { name: 'Send Ann a tip' })).toBeInTheDocument();
  });

  it('shows a QR method rendered from its payload, with who it pays', async () => {
    render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const img = await screen.findByAltText('Payment QR for JUAN DELA CRUZ');
    expect(img).toHaveAttribute('src', PNG);
    expect(toDataURL.mock.calls[0][0]).toBe(PAYLOAD);
    expect(screen.getByText('Pays to JUAN DELA CRUZ')).toBeInTheDocument();
    expect(screen.getByText('MANDALUYONG, Philippines')).toBeInTheDocument();
    expect(screen.getByText('Pays in PHP')).toBeInTheDocument();
    expect(screen.getByText('Scan or upload this QR in your bank or e-wallet app.')).toBeInTheDocument();
  });

  it('fetches the QR payloads only when the sheet opens, and only once', async () => {
    render(PayButton, { props: props() });
    expect(fetchMock).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for JUAN DELA CRUZ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/@ann/pay');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for JUAN DELA CRUZ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches nothing when there is no QR', async () => {
    render(PayButton, { props: props({ methods: [paypal] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says so when the QR cannot be loaded, and tries again on request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(await screen.findByText('Could not load this QR.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByAltText('Payment QR for JUAN DELA CRUZ')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reserves the QR size before it renders', async () => {
    toDataURL.mockReturnValue(new Promise(() => {}));
    const { container } = render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const frame = container.ownerDocument.querySelector('.qr-frame');
    expect(frame).not.toBeNull();
    expect(frame.querySelector('img')).toBeNull();
  });

  it('offers the QR as a PNG download', async () => {
    render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const save = await screen.findByRole('link', { name: 'Save QR image' });
    expect(save).toHaveAttribute('href', PNG);
    expect(save).toHaveAttribute('download', 'ann-payment-qr.png');
  });

  it('shows a link method as a button that opens the service in a new tab', async () => {
    render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const link = screen.getByRole('link', { name: 'Pay with PayPal' });
    expect(link).toHaveAttribute('href', 'https://paypal.me/ana');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('closes on Escape and returns focus to the button', async () => {
    render(PayButton, { props: props() });
    const button = screen.getByRole('button', { name: 'Pay' });
    await fireEvent.click(button);
    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it('closes with the close button', async () => {
    render(PayButton, { props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
