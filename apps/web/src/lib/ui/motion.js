/** True when the user asked for less motion (or there is no window). */
export function reducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Transition params with duration 0 under reduced motion. */
export function motion(params) {
  return reducedMotion() ? { ...params, duration: 0 } : params;
}
