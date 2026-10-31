import { z } from 'zod';

export type Surface = 'direct' | 'profile' | 'api';

export interface ClickEvent {
	v: 1;
	linkId: number;
	ts: number;
	country: string | null;
	userAgent: string | null;
	referer: string | null;
	surface: Surface;
	profileId: number | null;
	rowId: number | null;
}

const MAX_STRING = 2048;
const positiveInt = z.number().int().positive();

const clickEventSchema = z.object({
	v: z.literal(1),
	linkId: positiveInt,
	ts: z.number().finite(),
	country: z.string().length(2).nullable(),
	userAgent: z.string().max(MAX_STRING).nullable(),
	referer: z.string().max(MAX_STRING).nullable(),
	surface: z.enum(['direct', 'profile', 'api']),
	profileId: positiveInt.nullable(),
	rowId: positiveInt.nullable()
});

export function parseClickEvent(input: unknown): ClickEvent | null {
	const result = clickEventSchema.safeParse(input);
	return result.success ? result.data : null;
}
