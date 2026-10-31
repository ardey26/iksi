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

import { isDbId } from '../ids';

const MAX_STRING = 2048;
const SURFACES: readonly string[] = ['direct', 'profile', 'api'];

const isNullable = (v: unknown, ok: (x: unknown) => boolean) => v === null || ok(v);
const isShortString = (v: unknown) => typeof v === 'string' && v.length <= MAX_STRING;

/** Hand-written (not zod) to keep the edge Worker bundle small. Unknown keys are dropped. */
export function parseClickEvent(input: unknown): ClickEvent | null {
	if (typeof input !== 'object' || input === null) return null;
	const e = input as Record<string, unknown>;
	if (
		e.v !== 1 ||
		!isDbId(e.linkId) ||
		!(typeof e.ts === 'number' && Number.isFinite(e.ts)) ||
		!isNullable(e.country, (c) => typeof c === 'string' && c.length === 2) ||
		!isNullable(e.userAgent, isShortString) ||
		!isNullable(e.referer, isShortString) ||
		typeof e.surface !== 'string' ||
		!SURFACES.includes(e.surface) ||
		!isNullable(e.profileId, isDbId) ||
		!isNullable(e.rowId, isDbId)
	) {
		return null;
	}
	return {
		v: 1,
		linkId: e.linkId,
		ts: e.ts,
		country: e.country as string | null,
		userAgent: e.userAgent as string | null,
		referer: e.referer as string | null,
		surface: e.surface as Surface,
		profileId: e.profileId as number | null,
		rowId: e.rowId as number | null
	};
}
