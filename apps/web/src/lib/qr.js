// The iksi QR code, shared by the home page result and /tools/qr-code: our
// colors and margin, with the brand mark in the middle on a white halo.
// Error correction H (about 30% recoverable) leaves room for the mark,
// which covers roughly 5% of the code with its halo.

/** The brand mark: black disc, white chain links. */
export const IKSI_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0A0A0B"/><g transform="rotate(-45 12 12)" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round"><rect x="4" y="10" width="7" height="4" rx="2"/><rect x="13" y="10" width="7" height="4" rx="2"/></g></svg>`;

export const QR_OPTIONS = { margin: 2, errorCorrectionLevel: 'H', color: { dark: '#0A0A0B', light: '#FFFFFF' } };

const loadImage = (src) =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});

/**
 * `text` as a PNG data URL, `size` px square, with the mark in its centre.
 * Without a 2D canvas (very old browsers, tests) it returns the plain code,
 * which still scans. Throws when the text is too long for a QR code.
 */
export async function iksiQR(text, size = 1024) {
	const { default: QRCode } = await import('qrcode');
	const plain = await QRCode.toDataURL(text, { ...QR_OPTIONS, width: size });
	if (typeof CanvasRenderingContext2D === 'undefined') return plain;
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return plain;

	const [code, logo] = await Promise.all([
		loadImage(plain),
		loadImage(`data:image/svg+xml;base64,${btoa(IKSI_LOGO_SVG)}`)
	]);
	canvas.width = code.width;
	canvas.height = code.height;
	ctx.drawImage(code, 0, 0);
	const logoSize = Math.round(canvas.width * 0.22);
	const halo = Math.max(6, Math.round(canvas.width * 0.015));
	const cx = canvas.width / 2;
	const cy = canvas.height / 2;
	// Clear the modules behind the mark as a circle, so it sits on a clean halo.
	ctx.fillStyle = '#FFFFFF';
	ctx.beginPath();
	ctx.arc(cx, cy, logoSize / 2 + halo, 0, Math.PI * 2);
	ctx.fill();
	ctx.drawImage(logo, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
	return canvas.toDataURL('image/png');
}

/**
 * A data URL as a Blob, decoded in place: `fetch(dataUrl)` would be blocked
 * by the CSP (connect-src 'self' does not allow data:).
 */
export function dataUrlToBlob(dataUrl) {
	const [head, body] = dataUrl.split(',');
	const type = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
	const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
	return new Blob([bytes], { type });
}
