import type { ClickEvent } from './event';

type SurfaceFields = Pick<ClickEvent, 'surface' | 'profileId' | 'rowId'>;

const DIRECT: SurfaceFields = { surface: 'direct', profileId: null, rowId: null };

function positiveInt(value: string | null): number | null {
	if (value === null || !/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Reads where a click came from. Profile clicks need both ids; anything unusable is direct. */
export function surfaceFromQuery(params: URLSearchParams): SurfaceFields {
	const s = params.get('s');
	if (s === 'api') return { surface: 'api', profileId: null, rowId: null };
	if (s === 'profile') {
		const profileId = positiveInt(params.get('p'));
		const rowId = positiveInt(params.get('r'));
		if (profileId !== null && rowId !== null) return { surface: 'profile', profileId, rowId };
	}
	return { ...DIRECT };
}
