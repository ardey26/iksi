import { writable } from 'svelte/store';

/** @typedef {{ id: number, message: string, variant: 'neutral' | 'success' | 'error' }} ToastItem */

const DURATION = 4000;
const MAX = 3;
let next = 0;
const timers = new Map();

/** @type {import('svelte/store').Writable<ToastItem[]>} */
const items = writable([]);

export const toasts = { subscribe: items.subscribe };

/** Remove one toast now. */
export function dismiss(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items.update((list) => list.filter((t) => t.id !== id));
}

/**
 * Show a one-line message at the bottom of the screen. Auto-dismisses after 4s.
 * @param {string} message
 * @param {{ variant?: ToastItem['variant'], duration?: number }} [options]
 */
export function toast(message, { variant = 'neutral', duration = DURATION } = {}) {
  const id = ++next;
  items.update((list) => [...list, { id, message, variant }].slice(-MAX));
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration));
  return id;
}
