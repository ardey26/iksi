import sharp from 'sharp';

export type MediaKind = 'avatar' | 'background';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 8000;
const WEBP_QUALITY = 82;

export class MediaError extends Error {
	code: 'too_large' | 'unsupported' | 'too_many_pixels' | 'empty';
	constructor(code: MediaError['code'], message?: string) {
		super(message ?? code);
		this.name = 'MediaError';
		this.code = code;
	}
}

export interface Variant {
	name: string;
	bytes: Uint8Array;
	width: number;
	height: number;
}

type Spec = { name: string; size: number; square: boolean };

const SPECS: Record<MediaKind, Spec[]> = {
	avatar: [
		{ name: '400', size: 400, square: true },
		{ name: '96', size: 96, square: true }
	],
	background: [{ name: '1600', size: 1600, square: false }]
};

function open(input: Uint8Array) {
	return sharp(input, {
		failOn: 'error',
		animated: false,
		limitInputPixels: MAX_DIMENSION * MAX_DIMENSION
	});
}

export async function processImage(input: Uint8Array, kind: MediaKind): Promise<Variant[]> {
	if (input.byteLength === 0) throw new MediaError('empty');
	if (input.byteLength > MAX_UPLOAD_BYTES) throw new MediaError('too_large');

	try {
		const meta = await open(input).metadata();
		if (!meta.width || !meta.height) throw new MediaError('unsupported');
		if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
			throw new MediaError('too_many_pixels');
		}

		return await Promise.all(
			SPECS[kind].map(async (spec) => {
				const pipeline = open(input).rotate();
				pipeline.resize(
					spec.square
						? { width: spec.size, height: spec.size, fit: 'cover', position: 'centre' }
						: { width: spec.size, height: spec.size, fit: 'inside', withoutEnlargement: true }
				);
				const { data, info } = await pipeline
					.webp({ quality: WEBP_QUALITY })
					.toBuffer({ resolveWithObject: true });
				return {
					name: spec.name,
					bytes: new Uint8Array(data),
					width: info.width,
					height: info.height
				};
			})
		);
	} catch (e) {
		if (e instanceof MediaError) throw e;
		throw new MediaError('unsupported');
	}
}

export function mediaBaseKey(userId: number, kind: MediaKind, id: string): string {
	return `${userId}/${kind}/${id}`;
}

export function variantKey(baseKey: string, variant: string): string {
	return `${baseKey}.${variant}.webp`;
}
