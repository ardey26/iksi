// Per-instance cache of the payload used by the root layout loader
// (user identity + handle + display name/avatar for the header). The layout
// runs on every navigation; without this, every logged-in page load pays a
// user + handle + profile join.
//
// TTL is short by design — profile edits become visible on the next
// navigation after ~30s at worst. Mutation sites should call
// `invalidateUserCache(uid)` to make the change visible immediately.

export type CachedUserPayload = {
  id: number;
  twitterHandle: string | null;
  googleEmail: string | null;
  handle: string | null;
  profileId: number | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export const USER_CACHE_TTL_MS = 30_000;

const store = new Map<number, { expires: number; user: CachedUserPayload | null }>();

export function getCachedUser(uid: number): CachedUserPayload | null | undefined {
  const entry = store.get(uid);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    store.delete(uid);
    return undefined;
  }
  return entry.user;
}

export function setCachedUser(uid: number, user: CachedUserPayload | null): void {
  store.set(uid, { expires: Date.now() + USER_CACHE_TTL_MS, user });
}

export function invalidateUserCache(uid: number): void {
  store.delete(uid);
}
