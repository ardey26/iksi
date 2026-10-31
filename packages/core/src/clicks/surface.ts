import type { ClickEvent } from './event';
import { isDbId } from '../ids';

type SurfaceFields = Pick<ClickEvent, 'surface' | 'profileId' | 'rowId'>;

const DIRECT: SurfaceFields = { surface: 'direct', profileId: null, rowId: null };

function dbId(value: string | null): number | null {
	if (value === null || !/^\d+$/.test(value)) return null;
	const n = Number(value);
	return isDbId(n) ? n : null;
}

/** Reads where a click came from. Profile clicks need both ids; anything unusable is direct. */
export function surfaceFromQuery(params: URLSearchParams): SurfaceFields {
	const s = params.get('s');
	if (s === 'api') return { surface: 'api', profileId: null, rowId: null };
	if (s === 'profile') {
		const profileId = dbId(params.get('p'));
		const rowId = dbId(params.get('r'));
		if (profileId !== null && rowId !== null) return { surface: 'profile', profileId, rowId };
	}
	return { ...DIRECT };
}
