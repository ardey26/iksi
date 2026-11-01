// Builds EMVCo merchant-presented payment payloads (QR Ph by default) for tests. The CRC here is
// written independently of src/lib/server/pay-qr.ts so the two check each other.

export function tlv(tag: string, value: string): string {
	return tag + String(value.length).padStart(2, '0') + value;
}

/** CRC-16/CCITT-FALSE: init 0xFFFF, poly 0x1021, no reflection, no final xor. */
export function testCrc(s: string): string {
	let crc = 0xffff;
	for (const byte of new TextEncoder().encode(s)) {
		crc ^= byte << 8;
		for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
	}
	return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Appends tag 63 with the checksum over everything up to and including "6304". */
export function withCrc(body: string): string {
	const head = body + '6304';
	return head + testCrc(head);
}

export interface PayloadParts {
	guid?: string;
	merchantTag?: string;
	/** '' leaves tag 58 out. */
	country?: string;
	/** '' leaves tag 53 out. */
	currency?: string;
	name?: string | null;
	city?: string | null;
	/** The account's bank or e-wallet BIC (sub-tag 01 of the merchant account); '' leaves it out. */
	bic?: string;
}

/** The body of a payload, without tag 63. Defaults to a GCash-style P2P code. */
export function payQrBody(p: PayloadParts = {}): string {
	const {
		guid = 'com.p2pqrpay',
		merchantTag = '27',
		country = 'PH',
		currency = '608',
		name = 'JUAN DELA CRUZ',
		city = 'MANDALUYONG',
		bic = 'GXCHPHM2XXX'
	} = p;
	return (
		tlv('00', '01') +
		tlv('01', '11') +
		tlv(merchantTag, tlv('00', guid) + (bic === '' ? '' : tlv('01', bic)) + tlv('02', '99964403') + tlv('04', '09171234567')) +
		tlv('52', '6016') +
		(currency === '' ? '' : tlv('53', currency)) +
		(country === '' ? '' : tlv('58', country)) +
		(name === null ? '' : tlv('59', name)) +
		(city === null ? '' : tlv('60', city))
	);
}

export function payQrPayload(p: PayloadParts = {}): string {
	return withCrc(payQrBody(p));
}

/** A payload whose checksum does not match its contents. */
export function damagedPayload(): string {
	const good = payQrPayload();
	const last = good.slice(-4);
	const wrong = last === '0000' ? '0001' : '0000';
	return good.slice(0, -4) + wrong;
}
