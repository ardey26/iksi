import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import PaymentMethods from './PaymentMethods.svelte';

const qr = {
  id: 'q1',
  kind: 'qr',
  label: 'Bank QR',
  payload: '000201...',
  name: 'JUAN DELA CRUZ',
  city: 'MANDALUYONG',
  country: 'PH',
  currency: 'PHP'
};
const paypal = { id: 'l1', kind: 'link', provider: 'paypal', url: 'https://paypal.me/ana' };
const kofi = { id: 'l2', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ana' };
const gcash = { ...qr, id: 'q2', institution: 'gcash', label: 'GCash', payload: '000201gc', name: 'ANA REYES' };
const png = (name = 'qr.png') => new File(['x'], name, { type: 'image/png' });
const pickFiles = (container, files) =>
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files } });
const openLink = () => fireEvent.click(screen.getByRole('button', { name: 'Add payment link' }));

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const bad = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

describe('PaymentMethods', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the list', () => {
    it('shows each QR by its label, with who it pays in title case', () => {
      render(PaymentMethods, { props: { methods: [qr, paypal], label: 'pay' } });
      expect(screen.getByText('Pays to Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Mandaluyong, Philippines')).toBeInTheDocument();
      expect(screen.getByTitle('Pays in PHP')).toHaveTextContent('PHP');
      expect(screen.getByText('Bank QR')).toBeInTheDocument();
      expect(screen.getByText('PayPal')).toBeInTheDocument();
      // A link shows without its scheme; the full URL is its title.
      expect(screen.getByText('paypal.me/ana')).toHaveAttribute('title', 'https://paypal.me/ana');
    });

    it("marks a known bank's QR with its logo and an unknown bank's with a monogram", () => {
      const { container } = render(PaymentMethods, { props: { methods: [gcash, qr], label: 'pay' } });
      const [first, second] = container.querySelectorAll('li');
      expect(first.querySelector('img')).toHaveAttribute('src', '/brands/gcash.svg');
      expect(first).toHaveTextContent('Pays to Ana Reyes');
      expect(second.querySelector('img')).toBeNull();
      // A monogram, not a logo: the label's first letter on its own tile.
      expect(second.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent(/^B$/);
      expect(screen.getByRole('button', { name: 'Remove GCash' })).toBeInTheDocument();
    });

    it('shows a wordmark logo wide, without repeating its name as text', () => {
      const maya = { ...qr, id: 'q3', institution: 'maya', label: 'Maya', name: 'MARIA SANTOS' };
      const { container } = render(PaymentMethods, { props: { methods: [maya, gcash], label: 'pay' } });
      const [first, second] = container.querySelectorAll('li');
      expect(first.querySelector('.logo.wordmark img')).toHaveAttribute('src', '/brands/maya.svg');
      expect(within(first).getByText('Maya')).toHaveClass('sr-only');
      expect(second.querySelector('.logo.wordmark')).toBeNull();
      expect(within(second).getByText('GCash')).not.toHaveClass('sr-only');
    });

    it('gives every row the same media width, so the text lines up', () => {
      const maya = { ...qr, id: 'q3', institution: 'maya', label: 'Maya' };
      const { container } = render(PaymentMethods, { props: { methods: [gcash, maya, qr, paypal], label: 'pay' } });
      const rows = [...container.querySelectorAll('li.row')];
      expect(rows.map((r) => r.querySelector('.media')?.style.width)).toEqual(['64px', '64px', '64px', '64px']);
      // A QR's who-and-where lines wrap rather than truncate on a phone.
      expect(rows[1].querySelector('.subtitle')).toHaveClass('wrap');
    });

    it('lists no banks to choose from', () => {
      render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      expect(screen.queryByRole('button', { name: /GCash|Maya|MariBank/ })).toBeNull();
      expect(screen.queryByRole('img')).toBeNull();
    });
  });

  describe('adding QRs', () => {
    it('offers one button that picks several images', () => {
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      const button = screen.getByRole('button', { name: 'Add payment QR' });
      // With nothing added yet, it is the section's primary action.
      expect(button).toHaveClass('primary');
      const input = container.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('multiple');
      expect(input.getAttribute('accept')).toContain('image/png');
    });

    it('uploads one image and says which bank it was', async () => {
      fetchMock.mockResolvedValue(ok({ methods: [gcash], label: 'pay', added: 'q2' }));
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await pickFiles(container, [png()]);
      expect(await screen.findByText('Pays to Ana Reyes')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Added GCash');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/pay-methods');
      expect(init.method).toBe('POST');
      expect(init.body.get('kind')).toBe('qr');
      expect(init.body.get('file')).toBeInstanceOf(File);
      expect(init.body.get('provider')).toBeNull();
    });

    it('uploads several images one by one and reports each', async () => {
      fetchMock
        .mockResolvedValueOnce(ok({ methods: [gcash], label: 'pay', added: 'q2' }))
        .mockResolvedValueOnce(bad(400, "That QR isn't a payment QR or a supported payment link."))
        .mockResolvedValueOnce(ok({ methods: [gcash, qr], label: 'pay', added: 'q1' }));
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await pickFiles(container, [png('gcash.png'), png('menu.png'), png('bpi.png')]);
      const report = await screen.findByRole('list', { name: 'Upload results' });
      await waitFor(() => expect(within(report).getAllByRole('listitem')).toHaveLength(3));
      expect(within(report).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'gcash.png: Added GCash',
        "menu.png: That QR isn't a payment QR or a supported payment link.",
        'bpi.png: Added Bank QR'
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls.map(([, init]) => init.body.get('file').name)).toEqual(['gcash.png', 'menu.png', 'bpi.png']);
      expect(screen.getByText('Pays to Juan Dela Cruz')).toBeInTheDocument();
    });

    it('sends the next image only after the previous one is saved', async () => {
      let release;
      fetchMock.mockReturnValueOnce(new Promise((r) => (release = r))).mockResolvedValue(ok({ methods: [gcash, qr], label: 'pay', added: 'q1' }));
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await pickFiles(container, [png('a.png'), png('b.png')]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Add payment QR' })).toBeDisabled();
      release(ok({ methods: [gcash], label: 'pay', added: 'q2' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });

    it('stops sending once the profile is full and says why', async () => {
      const five = [1, 2, 3, 4, 5].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
      fetchMock.mockResolvedValue(ok({ methods: [...five, gcash], label: 'pay', added: 'q2' }));
      const { container } = render(PaymentMethods, { props: { methods: five, label: 'pay' } });
      await pickFiles(container, [png('a.png'), png('b.png')]);
      const report = await screen.findByRole('list', { name: 'Upload results' });
      await waitFor(() => expect(within(report).getAllByRole('listitem')).toHaveLength(2));
      expect(within(report).getAllByRole('listitem')[1]).toHaveTextContent(
        'b.png: Not added. You can have up to 6 payment methods.'
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses an image over 4 MB without sending it', async () => {
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
      await pickFiles(container, [big]);
      expect(await screen.findByRole('alert')).toHaveTextContent('Images must be under 4 MB.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the reason a single upload was refused', async () => {
      fetchMock.mockResolvedValue(bad(400, "That QR isn't a payment QR or a supported payment link."));
      const { container } = render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await pickFiles(container, [png()]);
      expect(await screen.findByRole('alert')).toHaveTextContent("That QR isn't a payment QR or a supported payment link.");
    });
  });

  describe('adding a link', () => {
    it('keeps the link field behind a secondary button', async () => {
      render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      const more = screen.getByRole('button', { name: 'Add payment link' });
      expect(more).toHaveClass('secondary');
      expect(more).toHaveAttribute('aria-expanded', 'false');
      await openLink();
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText('Payment link')).toBeInTheDocument();
    });

    it('adds a pasted link', async () => {
      fetchMock.mockResolvedValue(ok({ methods: [paypal], label: 'pay', added: 'l1' }));
      render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await openLink();
      await fireEvent.input(screen.getByLabelText('Payment link'), { target: { value: 'https://paypal.me/ana' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
      expect(await screen.findByText('paypal.me/ana')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Added PayPal');
      const init = fetchMock.mock.calls[0][1];
      expect(init.body.get('kind')).toBe('link');
      expect(init.body.get('url')).toBe('https://paypal.me/ana');
      expect(screen.getByLabelText('Payment link')).toHaveValue('');
    });

    it('keeps a refused link in the field and says why', async () => {
      fetchMock.mockResolvedValue(bad(400, 'Use a link from PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.'));
      render(PaymentMethods, { props: { methods: [], label: 'pay' } });
      await openLink();
      await fireEvent.input(screen.getByLabelText('Payment link'), { target: { value: 'https://evil.example/' } });
      await fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
      expect(await screen.findByText(/^Use a link from PayPal/)).toBeInTheDocument();
      expect(screen.getByLabelText('Payment link')).toHaveValue('https://evil.example/');
    });
  });

  describe('renaming', () => {
    const rename = (name) => fireEvent.click(screen.getByRole('button', { name: `Rename ${name}` }));

    it('is an icon button with an accessible name, so the row text keeps its room', () => {
      render(PaymentMethods, { props: { methods: [gcash], label: 'pay' } });
      const btn = screen.getByRole('button', { name: 'Rename GCash' });
      expect(btn).toHaveTextContent('');
      expect(btn).toHaveAttribute('title', 'Rename GCash');
      expect(btn.querySelector('svg.lucide-pencil')).not.toBeNull();
    });

    it('renames a QR in place and saves it', async () => {
      fetchMock.mockResolvedValue(ok({ methods: [{ ...gcash, label: 'Shop' }], label: 'pay' }));
      render(PaymentMethods, { props: { methods: [gcash], label: 'pay' } });
      await rename('GCash');
      const field = screen.getByRole('textbox', { name: 'Name for GCash' });
      expect(field).toHaveValue('GCash');
      expect(field).toHaveAttribute('maxlength', '24');
      await fireEvent.input(field, { target: { value: 'Shop' } });
      await fireEvent.submit(field.closest('form'));
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/pay-methods');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ rename: { id: 'q2', label: 'Shop' } });
      expect(await screen.findByRole('button', { name: 'Rename Shop' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /^Name for/ })).toBeNull();
    });

    it('cancels with Escape and changes nothing', async () => {
      render(PaymentMethods, { props: { methods: [gcash], label: 'pay' } });
      await rename('GCash');
      const field = screen.getByRole('textbox', { name: 'Name for GCash' });
      await fireEvent.input(field, { target: { value: 'Shop' } });
      await fireEvent.keyDown(field, { key: 'Escape' });
      expect(screen.queryByRole('textbox', { name: 'Name for GCash' })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename GCash' })));
    });

    it('keeps the field open and says why when the name is refused', async () => {
      fetchMock.mockResolvedValue(bad(400, 'Names can be up to 24 characters of plain text.'));
      render(PaymentMethods, { props: { methods: [gcash], label: 'pay' } });
      await rename('GCash');
      const field = screen.getByRole('textbox', { name: 'Name for GCash' });
      await fireEvent.input(field, { target: { value: '<b>' } });
      await fireEvent.submit(field.closest('form'));
      expect(await screen.findByText('Names can be up to 24 characters of plain text.')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Name for GCash' })).toHaveValue('<b>');
    });

    it('offers no rename for a link, which is named by its service', () => {
      render(PaymentMethods, { props: { methods: [paypal], label: 'pay' } });
      expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    });
  });

  it('removes a method', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [qr, paypal], label: 'pay' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Bank QR' }));
    // Removing asks first, in the row.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Remove it from your Pay button?')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('Pays to Juan Dela Cruz')).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith('/api/pay-methods?id=q1', { method: 'DELETE' });
  });

  it('hides the add controls at six methods and says why', () => {
    const more = [1, 2, 3].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByRole('button', { name: 'Add payment QR' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add payment link' })).toBeNull();
    expect(screen.getByText(/6 payment methods, the most a profile can have/)).toBeInTheDocument();
  });

  it('still offers to add at five methods', () => {
    const more = [1, 2].map((i) => ({ ...kofi, id: `k${i}`, url: `https://ko-fi.com/ana${i}` }));
    render(PaymentMethods, { props: { methods: [qr, paypal, kofi, ...more], label: 'pay' } });
    expect(screen.queryByText(/the most a profile can have/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Add payment QR' })).toBeInTheDocument();
  });

  const reorder = async (name, ...keys) => {
    const grip = screen.getByRole('button', { name: `Reorder ${name}` });
    grip.focus();
    await fireEvent.keyDown(grip, { key: ' ' });
    for (const key of keys) await fireEvent.keyDown(grip, { key });
    await fireEvent.keyDown(grip, { key: ' ' });
  };
  const order = () => screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'));

  it('reorders on the grip and saves the new order', async () => {
    fetchMock.mockResolvedValue(ok({ methods: [qr, gcash, paypal], label: 'pay' }));
    render(PaymentMethods, { props: { methods: [gcash, qr, paypal], label: 'pay' } });
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    await reorder('Bank QR', 'ArrowUp');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/pay-methods');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ order: ['q1', 'q2', 'l1'] });
    await waitFor(() => expect(order()).toEqual(['Remove Bank QR', 'Remove GCash', 'Remove PayPal']));
  });

  it('saves nothing when a lifted method is dropped where it was', async () => {
    render(PaymentMethods, { props: { methods: [gcash, paypal], label: 'pay' } });
    await reorder('GCash', 'ArrowUp');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts the order back when saving it fails', async () => {
    fetchMock.mockResolvedValue(bad(409, 'Your payment methods changed in another tab. Reload and try again.'));
    render(PaymentMethods, { props: { methods: [gcash, paypal], label: 'pay' } });
    await reorder('PayPal', 'ArrowUp');
    expect(await screen.findByRole('alert')).toHaveTextContent('changed in another tab');
    expect(order()).toEqual(['Remove GCash', 'Remove PayPal']);
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
