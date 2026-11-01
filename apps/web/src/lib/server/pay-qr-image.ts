// Reads the QR in an uploaded screenshot or photo. The image itself is never
// stored: only what the QR holds is kept, and the QR is re-rendered from it.
import jsQR from 'jsqr';
import { checkImage, MediaError, openImage } from './media';

// Large enough for a QR that fills a small part of a phone photo; small enough
// that the decoder stays fast on a 48 MP camera image.
const DECODE_MAX_SIDE = 2000;

async function decodeQrText(input: Uint8Array): Promise<string | null> {
	try {
		const { data, info } = await openImage(input)
			.rotate()
			.resize({ width: DECODE_MAX_SIDE, height: DECODE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
		return jsQR(pixels, info.width, info.height)?.data || null;
	} catch (e) {
		console.error('pay-qr: decode failed', e);
		throw new MediaError('unsupported');
	}
}

/** The text a QR in the image holds, or null when there is no QR. Throws MediaError for a bad image. */
export async function decodeQrImage(input: Uint8Array): Promise<string | null> {
	await checkImage(input);
	return decodeQrText(input);
}
