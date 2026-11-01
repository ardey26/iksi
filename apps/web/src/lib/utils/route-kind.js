/** `/@handle`: the public profile page. `/@handle/name` is a short link, not a profile. */
export const isProfilePath = (pathname) => /^\/@[^/]+\/?$/.test(pathname);

