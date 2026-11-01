/** `/@handle`: the public profile page. `/@handle/name` is a short link, not a profile. */
export const isProfilePath = (pathname) => /^\/@[^/]+\/?$/.test(pathname);

/** The signed-in dashboard and its sub-pages. */
export const isDashboardPath = (pathname) => pathname === '/dashboard' || pathname.startsWith('/dashboard/');
