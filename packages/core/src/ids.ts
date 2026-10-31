/** Largest Postgres INT4: `LongURL.id`, `Profile.id` and `ProfileRow.id` are all INT4. */
export const MAX_DB_ID = 2_147_483_647;

/** A positive integer that fits an INT4 primary key. Anything larger makes a Postgres lookup throw. */
export const isDbId = (v: unknown): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_DB_ID;
