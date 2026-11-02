import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const toDataURL = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toDataURL } }));

import PayButton from './PayButton.svelte';

const PAYLOAD = '00020101021127...6304ABCD';
// What the page gets: no payload. The sheet fetches it when opened.
const qr = {
  id: 'q1',
  kind: 'qr',
  label: 'Bank QR',
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
    const img = await screen.findByAltText('Payment QR for Juan Dela Cruz');
    expect(img).toHaveAttribute('src', PNG);
    expect(toDataURL.mock.calls[0][0]).toBe(PAYLOAD);
    expect(screen.getByText('Pays to Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Mandaluyong, Philippines')).toBeInTheDocument();
    expect(screen.getByText('Pays in PHP')).toBeInTheDocument();
    expect(screen.getByText('Scan or upload this QR in your bank or e-wallet app.')).toBeInTheDocument();
  });

  it('fetches the QR payloads only when the sheet opens, and only once', async () => {
    render(PayButton, { props: props() });
    expect(fetchMock).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for Juan Dela Cruz');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/@ann/pay');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for Juan Dela Cruz');
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
    expect(await screen.findByAltText('Payment QR for Juan Dela Cruz')).toBeInTheDocument();
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
    render(PayButton, { props: props({ methods: [paypal] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const link = screen.getByRole('link', { name: 'Pay with PayPal' });
    expect(link).toHaveAttribute('href', 'https://paypal.me/ana');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it("heads a lone link method with its provider's logo", async () => {
    render(PayButton, { props: props({ methods: [paypal] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(document.querySelector('.pay-who img')).toHaveAttribute('src', '/brands/paypal.svg');
  });

  it("shows the bank's logo and name above who it pays", async () => {
    render(PayButton, { props: props({ methods: [{ ...qr, institution: 'gcash', label: 'GCash' }] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const who = document.querySelector('.pay-who');
    expect(who.querySelector('img')).toHaveAttribute('src', '/brands/gcash.svg');
    expect(who).toHaveTextContent('GCash');
    expect(screen.getByText('Pays to Juan Dela Cruz')).toBeInTheDocument();
  });

  it("keeps the bank's logo on a QR the owner renamed", async () => {
    render(PayButton, { props: props({ methods: [{ ...qr, institution: 'maribank', label: 'Shop' }] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const who = document.querySelector('.pay-who');
    expect(who.querySelector('img')).toHaveAttribute('src', '/brands/maribank.png');
    expect(who).toHaveTextContent('Shop');
  });

  it('marks a QR from an unknown bank with a monogram of its label', async () => {
    render(PayButton, { props: props({ methods: [qr] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await screen.findByAltText('Payment QR for Juan Dela Cruz');
    const who = document.querySelector('.pay-who');
    expect(who.querySelector('img')).toBeNull();
    expect(who.querySelector('.pay-monogram')).toHaveTextContent('B');
    expect(who).toHaveTextContent('Bank QR');
  });

  it('shows no picker with one method', async () => {
    render(PayButton, { props: props({ methods: [qr] }) });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  describe('with several methods', () => {
    const gcash = { ...qr, id: 'q2', institution: 'gcash', label: 'GCash', name: 'ANA REYES' };
    const many = () => props({ methods: [gcash, qr, paypal] });
    beforeEach(() => fetchMock.mockResolvedValue(ok({ payloads: { q1: PAYLOAD, q2: 'GCASHPAYLOAD' } })));

    it('offers a picker keyed by each method label, with its logo or monogram', async () => {
      render(PayButton, { props: many() });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      const picker = screen.getByRole('radiogroup', { name: 'Payment method' });
      const radios = within(picker).getAllByRole('radio');
      expect(radios.map((r) => r.labels[0].querySelector('.pay-key-text').textContent)).toEqual(['GCash', 'Bank QR', 'PayPal']);
      expect(radios.map((r) => r.labels[0].querySelectorAll('.pay-mark').length)).toEqual([1, 1, 1]);
      expect(within(picker).getByRole('radio', { name: 'GCash' }).labels[0].querySelector('img')).toHaveAttribute(
        'src',
        '/brands/gcash.svg'
      );
      expect(within(picker).getByRole('radio', { name: 'Bank QR' }).labels[0].querySelector('.pay-monogram')).toHaveTextContent('B');
      expect(within(picker).getByRole('radio', { name: 'PayPal' })).toBeInTheDocument();
    });

    it("keys a payment link by its provider's logo, keeping the name beside it", async () => {
      render(PayButton, { props: many() });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      const key = screen.getByRole('radio', { name: 'PayPal' }).labels[0];
      expect(key.querySelector('img')).toHaveAttribute('src', '/brands/paypal.svg');
      expect(key.querySelector('.pay-key-text')).not.toHaveClass('sr-only');
    });

    it('keys a wordmark by its logo alone, with the name kept for screen readers', async () => {
      const maya = { ...qr, id: 'q3', institution: 'maya', label: 'Maya' };
      render(PayButton, { props: props({ methods: [maya, gcash] }) });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      const key = screen.getByRole('radio', { name: 'Maya' }).labels[0];
      expect(key.querySelector('img')).toHaveAttribute('src', '/brands/maya.svg');
      expect(key.querySelector('.logo.wordmark')).not.toBeNull();
      expect(key.querySelector('.pay-key-text')).toHaveClass('sr-only');
      // A round mark keeps its visible name.
      expect(screen.getByRole('radio', { name: 'GCash' }).labels[0].querySelector('.pay-key-text')).not.toHaveClass('sr-only');
    });

    it('shows the name of a renamed wordmark QR', async () => {
      render(PayButton, { props: props({ methods: [{ ...qr, id: 'q3', institution: 'maya', label: 'Shop' }, gcash] }) });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      expect(screen.getByRole('radio', { name: 'Shop' }).labels[0].querySelector('.pay-key-text')).not.toHaveClass('sr-only');
    });

    it('keys a renamed QR by its new name', async () => {
      render(PayButton, { props: props({ methods: [{ ...gcash, label: 'Shop' }, qr] }) });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      expect(screen.getByRole('radio', { name: 'Shop' })).toBeChecked();
    });

    it('shows the first method in the owner order by default, and only it', async () => {
      render(PayButton, { props: many() });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      expect(screen.getByRole('radio', { name: 'GCash' })).toBeChecked();
      expect(await screen.findByAltText('Payment QR for Ana Reyes')).toBeInTheDocument();
      expect(screen.queryByText('Pays to Juan Dela Cruz')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Pay with PayPal' })).toBeNull();
    });

    it('switches the visible method when another is picked', async () => {
      render(PayButton, { props: many() });
      await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
      await screen.findByAltText('Payment QR for Ana Reyes');
      await fireEvent.click(screen.getByRole('radio', { name: 'Bank QR' }));
      expect(await screen.findByAltText('Payment QR for Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.queryByAltText('Payment QR for Ana Reyes')).toBeNull();
      await fireEvent.click(screen.getByRole('radio', { name: 'PayPal' }));
      expect(screen.getByRole('link', { name: 'Pay with PayPal' })).toBeInTheDocument();
      expect(screen.queryByAltText('Payment QR for Juan Dela Cruz')).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
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

  it("keeps the profile's palette in the sheet, which is moved to <body>", async () => {
    const host = document.createElement('div');
    host.setAttribute('data-palette', '');
    host.style.setProperty('--surface', 'rgb(1, 2, 3)');
    document.body.append(host);
    render(PayButton, { target: host, props: props() });
    await fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const root = screen.getByRole('dialog').parentElement;
    expect(host.contains(root)).toBe(false);
    expect(root.style.getPropertyValue('--surface')).toBe('rgb(1, 2, 3)');
    host.remove();
  });
});
