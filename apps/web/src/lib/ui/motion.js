/** True when the user asked for less motion (or there is no window). */
export function reducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Transition params with duration 0 under reduced motion. */
export function motion(params) {
  return reducedMotion() ? { ...params, duration: 0 } : params;
}

/**
 * A cubic-bezier easing as a function of t, for Svelte transitions that
 * must match the CSS tokens.
 */
export function bezier(x1, y1, x2, y2) {
  const coord = (a, b, t) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
  const slope = (a, b, t) => 3 * (1 - 3 * b + 3 * a) * t * t + 2 * (3 * b - 6 * a) * t + 3 * a;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton steps on the x curve, then read y at the same parameter.
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = coord(x1, x2, t) - x;
      if (Math.abs(d) < 1e-6) break;
      const s = slope(x1, x2, t);
      if (Math.abs(s) < 1e-6) break;
      t -= d / s;
    }
    return coord(y1, y2, Math.min(1, Math.max(0, t)));
  };
}

/** --ease-out: cubic-bezier(0.4, 0, 0.2, 1). */
export const easeOut = bezier(0.4, 0, 0.2, 1);

/** --duration-slow: progressive disclosure opens and closes in this time. */
export const DISCLOSE_MS = 200;

/**
 * Action: when the content inside `node` changes height, the node eases from
 * its old height to the new one instead of jumping, so what sits below it
 * glides. Nothing above moves. The content itself lays out at once; the
 * node only clips it while the height catches up. Instant under reduced
 * motion. Observes the node's first child, which should wrap the content.
 */
export function autoHeight(node) {
  const inner = node.firstElementChild;
  if (!inner || typeof ResizeObserver === 'undefined' || typeof node.animate !== 'function') return {};
  let height = inner.offsetHeight;
  let anim = null;
  const ro = new ResizeObserver(() => {
    const next = inner.offsetHeight;
    if (next === height) return;
    // Mid-animation, start from what is on screen now.
    const from = anim ? node.getBoundingClientRect().height : height;
    height = next;
    anim?.cancel();
    anim = null;
    if (reducedMotion()) return;
    node.style.overflow = 'hidden';
    const a = node.animate([{ height: `${from}px` }, { height: `${next}px` }], {
      duration: DISCLOSE_MS,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
    const done = () => {
      if (anim !== a) return;
      anim = null;
      node.style.overflow = '';
    };
    a.onfinish = done;
    a.oncancel = done;
    anim = a;
  });
  ro.observe(inner);
  return {
    destroy() {
      ro.disconnect();
      anim?.cancel();
    }
  };
}
