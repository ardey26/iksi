import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PaymentMethods from './PaymentMethods.svelte';

const qr = {
  id: 'q1',
  kind: 'qr',
  provider: null,
  payload: '000201...',
  name: 'JUAN DELA CRUZ',
  city: 'MANDALUYONG',
  country: 'PH',
  currency: 'PHP'
};
const paypal = { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' };
const kofi = { id: 'l2', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ana' };
const gcash = { ...qr, id: 'q2', provider: 'gcash', payload: '000201gc', name: 'ANA REYES' };
const other = () => fireEvent.click(screen.getByRole('button', { name: 'Other bank or payment link' }));
const pickFile = (container) =>
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], 'qr.png', { type: 'image/png' })] }
  });

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

  it('names each QR by its wallet logo and the name in it', () => {
    render(PaymentMethods, { props: { methods: [gcash, qr], label: 'pay' } });
    const logo = screen.getByRole('img', { name: 'GCash' });
    expect(logo.closest('.d-row')).toHaveTextContent('Pays to ANA REYES');
    expect(screen.getByText('Bank QR')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove GCash' })).toBeInTheDocument();
  });

  it('offers GCash, Maya and MariBank first, as buttons', () => {
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    for (const name of ['GCash', 'Maya', 'MariBank']) {
      const tile = screen.getByRole('button', { name: `Add ${name} QR` });
      expect(tile.tagName).toBe('BUTTON');
      expect(tile).toHaveAttribute('aria-pressed', 'false');
      expect(tile.querySelector('img')).not.toBeNull();
    }
    // Maya's logo is a wordmark, so only GCash and MariBank are captioned.
    expect(screen.getByText('GCash')).toBeInTheDocument();
    expect(screen.getByText('MariBank')).toBeInTheDocument();
    expect(screen.queryByText('Maya')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Upload a QR image' })).toBeNull();
  });

  it('shows where to find the QR in the wallet that was tapped', async () => {
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    expect(screen.queryByRole('button', { name: 'Choose image' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Add Maya QR' }));
    expect(screen.getByRole('button', { name: 'Add Maya QR' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^Open Maya and save your receive-money QR\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Add GCash QR' }));
    expect(screen.getByText(/^Open GCash and save your receive-money QR\./)).toBeInTheDocument();
  });

  it('uploads a QR with the wallet that was tapped', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [gcash], label: 'pay', notice: null }));
    const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add GCash QR' }));
    await pickFile(container);
    expect(await screen.findByText('Pays to ANA REYES')).toBeInTheDocument();
    const init = fetchMock.mock.calls[0][1];
    expect(init.body.get('kind')).toBe('qr');
    expect(init.body.get('provider')).toBe('gcash');
  });

  it('says when the QR was for another wallet', async () => {
    const mari = { ...gcash, provider: 'maribank' };
    fetchMock.mockResolvedValue(ok({ methods: [mari], label: 'pay', notice: 'This is a MariBank QR. Saved as MariBank.' }));
    const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add GCash QR' }));
    await pickFile(container);
    const note = await screen.findByText('This is a MariBank QR. Saved as MariBank.');
    expect(note).toHaveAttribute('role', 'status');
  });

  it('keeps any other bank or a payment link behind a quieter button', async () => {
    render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    const more = screen.getByRole('button', { name: 'Other bank or payment link' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await other();
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'Upload a QR image' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Paste a link' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });

  it('uploads the chosen image as a QR and shows the method the server read', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [qr], label: 'pay' }));
    const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
    await other();
    await pickFile(container);
    expect(await screen.findByText('Pays to JUAN DELA CRUZ')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pay-methods');
    expect(init.method).toBe('POST');
    expect(init.body.get('kind')).toBe('qr');
    expect(init.body.get('file')).toBeInstanceOf(File);
    expect(init.body.get('provider')).toBeNull();
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
    await other();
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
    await other();
    await fireEvent.click(screen.getByRole('radio', { name: 'Paste a link' }));
    await fireEvent.input(screen.getByLabelText('Payment link'), { target: { value: 'https://evil.example/' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Use a link from PayPal/);
    expect(screen.getByLabelText('Payment link')).toHaveValue('https://evil.example/');
  });

  it('removes a method', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [qr, paypal], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Bank QR' }));
    await waitFor(() => expect(screen.queryByText('Pays to JUAN DELA CRUZ')).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/api/pay-methods?id=q1', { method: 'DELETE' });
  });

  it('hides the add controls at six methods and says why', () => {
    const more = [1, 2, 3].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByRole('button', { name: 'Add GCash QR' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Other bank or payment link' })).toBeNull();
    expect(screen.getByText(/6 payment methods, the most a profile can have/)).toBeInTheDocument();
  });

  it('still offers to add at five methods', () => {
    const more = [1, 2].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByText(/the most a profile can have/)).toBeNull();
  });

  it('moves a method up and saves the new order', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [qr, gcash, paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [gcash, qr, paypal], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Move Bank QR up' }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pay-methods');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ order: ['q1', 'q2', 'l1'] });
    const rows = () => screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'));
    await waitFor(() => expect(rows()).toEqual(['Remove Bank QR', 'Remove GCash', 'Remove PayPal']));
  });

  it('cannot move the first up or the last down', () => {
    render(PaymentMethods, { props: { methods: [gcash, paypal], label: 'pay' } });
    expect(screen.getByRole('button', { name: 'Move GCash up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move GCash down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move PayPal down' })).toBeDisabled();
  });

  it('puts the order back when saving it fails', async () => {
    fetchMock.mockResolvedValue(bad(409, 'Your payment methods changed in another tab. Reload and try again.'));
    render(PaymentMethods, { props: { methods: [gcash, paypal], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Move PayPal up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('changed in another tab');
    const rows = screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'));
    expect(rows).toEqual(['Remove GCash', 'Remove PayPal']);
  });

  it('shows no order buttons for a single method', () => {
    render(PaymentMethods, { props: { methods: [gcash], label: 'pay' } });
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
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
