/** Shared by the server and the create forms; pure so the client can import it. */

/** Longest text a one-time link may hold. */
export const ONE_TIME_TEXT_MAX = 2000;

/** Unopened one-time links expire this long after they are made. */
export const ONE_TIME_TTL_DAYS = 7;
export const ONE_TIME_TTL_MS = ONE_TIME_TTL_DAYS * 24 * 60 * 60 * 1000;

export type OneTimeKind = 'url' | 'text';
