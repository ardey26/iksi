import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PaymentMethods from './PaymentMethods.svelte';

const qr = {
  id: 'q1',
  kind: 'qr',
  payload: '000201...',
  name: 'JUAN DELA CRUZ',
  city: 'MANDALUYONG',
  country: 'PH',
  currency: 'PHP'
};
const paypal = { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' };
const kofi = { id: 'l2', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ana' };

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const bad = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

describe('PaymentMethods', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists a QR by the name payers will see, and a link by its service', () => {
    render(PaymentMethods, { props: { methods: [qr, paypal], label: 'pay' } });
    expect(screen.getByText('Pays to JUAN DELA CRUZ')).toBeInTheDocument();
    expect(screen.getByText('MANDALUYONG, Philippines')).toBeInTheDocument();
    expect(screen.getByText('Pays in PHP')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();
    expect(screen.getByText('https://paypal.me/ana')).toBeInTheDocument();
  });

  it('offers two ways to add: upload a QR image or paste a link', () => {
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    expect(screen.getByRole('radio', { name: 'Upload a QR image' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Paste a link' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });

  it('uploads the chosen image as a QR and shows the method the server read', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [qr], label: 'pay' }));
    const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    const file = new File(['x'], 'qr.png', { type: 'image/png' });
    await fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });
    expect(await screen.findByText('Pays to JUAN DELA CRUZ')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pay-methods');
    expect(init.method).toBe('POST');
    expect(init.body.get('kind')).toBe('qr');
    expect(init.body.get('file')).toBeInstanceOf(File);
  });

  it('shows the reason an upload was refused', async () => {
    fetchMock.mockResolvedValue(bad(400, "That QR isn't a payment QR or a supported payment link."));
    const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['x'], 'qr.png', { type: 'image/png' })] }
    });
    expect(await screen.findByRole('alert')).toHaveTextContent("That QR isn't a payment QR or a supported payment link.");
  });

  it('adds a pasted link', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('radio', { name: 'Paste a link' }));
    await fireEvent.input(screen.getByLabelText('Payment link'), { target: { value: 'https://paypal.me/ana' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(await screen.findByText('PayPal')).toBeInTheDocument();
    const init = fetchMock.mock.calls[0][1];
    expect(init.body.get('kind')).toBe('link');
    expect(init.body.get('url')).toBe('https://paypal.me/ana');
    expect(screen.getByLabelText('Payment link')).toHaveValue('');
  });

  it('keeps a refused link in the field and says why', async () => {
    fetchMock.mockResolvedValue(bad(400, 'Use a link from PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.'));
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('radio', { name: 'Paste a link' }));
    await fireEvent.input(screen.getByLabelText('Payment link'), { target: { value: 'https://evil.example/' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Use a link from PayPal/);
    expect(screen.getByLabelText('Payment link')).toHaveValue('https://evil.example/');
  });

  it('removes a method', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [qr, paypal], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove QR code' }));
    await waitFor(() => expect(screen.queryByText('Pays to JUAN DELA CRUZ')).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/api/pay-methods?id=q1', { method: 'DELETE' });
  });

  it('hides the add controls at six methods and says why', () => {
    const more = [1, 2, 3].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByRole('radio', { name: 'Upload a QR image' })).toBeNull();
    expect(screen.getByText(/6 payment methods, the most a profile can have/)).toBeInTheDocument();
  });

  it('still offers to add at five methods', () => {
    const more = [1, 2].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByText(/the most a profile can have/)).toBeNull();
  });

  it('saves the button label when switched', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [], label: 'tip' }));
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('radio', { name: 'Send a tip' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pay-methods');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ label: 'tip' });
  });

  it('puts the label back when saving it fails', async () => {
    fetchMock.mockResolvedValue(bad(500, 'Server error'));
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('radio', { name: 'Send a tip' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Pay' })).toBeChecked());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the label.');
  });
});
