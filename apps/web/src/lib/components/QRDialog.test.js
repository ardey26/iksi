import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('#lib/qr.js', () => ({
  iksiQR: vi.fn(async () => 'data:image/png;base64,AAAA'),
  dataUrlToBlob: vi.fn(() => new Blob(['png'], { type: 'image/png' }))
}));

import ShortenedURL from './ShortenedURL.svelte';
import { iksiQR } from '#lib/qr.js';

// The home page result and /tools/qr-code open one QR dialog (QRDialog).
describe('home page QR', () => {
  it('opens the shared centered QR dialog with the iksi code, made on open', async () => {
    render(ShortenedURL, { props: { shortURL: 'AbC' } });
    expect(iksiQR).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Show QR code' }));
    const dialog = await screen.findByRole('dialog', { name: 'QR code' });
    expect(dialog).toHaveClass('center');
    await screen.findByAltText(/QR code for .*\/AbC$/);
    expect(iksiQR).toHaveBeenCalledWith(expect.stringMatching(/\/AbC$/), 1024);
    expect(screen.getByRole('link', { name: 'Download PNG' })).toHaveAttribute('download', 'iksi-AbC.png');
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeInTheDocument();
  });
});
