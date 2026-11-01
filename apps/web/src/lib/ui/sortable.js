// Pure pieces of the reorder interaction (SortableList + DragHandle).

/** A touch must rest this long on the handle before the row lifts. */
export const LONG_PRESS_MS = 250;
/** Touch movement (px) that means "scrolling", which abandons the press. */
export const TOUCH_SLOP = 8;
/** Mouse or pen movement (px) that starts a drag. */
export const DRAG_THRESHOLD = 3;

/**
 * What a press on the handle should do now.
 * Touch waits for a long press so a swipe that starts on the handle still
 * scrolls the page; mouse and pen lift as soon as they move.
 * @param {{ pointerType: string, elapsed: number, distance: number }} press
 * @returns {'wait' | 'lift' | 'cancel'}
 */
export function pressDecision({ pointerType, elapsed, distance }) {
  if (pointerType === 'touch') {
    if (distance > TOUCH_SLOP) return 'cancel';
    return elapsed >= LONG_PRESS_MS ? 'lift' : 'wait';
  }
  return distance >= DRAG_THRESHOLD ? 'lift' : 'wait';
}

/** A copy of list with the item at `from` moved to `to`. */
export function moveItem(list, from, to) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where a row lifted from `from` would land, given the original vertical
 * midpoints of every row and the lifted row's current centre.
 */
export function targetIndex(mids, from, center) {
  let to = from;
  for (let i = from + 1; i < mids.length; i++) if (center > mids[i]) to = i;
  for (let i = from - 1; i >= 0; i--) if (center < mids[i]) to = i;
  return to;
}

/**
 * Translations for a lift from `from` to `to`: the lifted row moves by
 * `lifted` px, and each row it passes shifts by the lifted row's height to
 * open the slot.
 * @param {number[]} heights row heights in order
 * @returns {{ lifted: number, shifts: number[] }}
 */
export function offsets(heights, from, to) {
  const shifts = heights.map(() => 0);
  let lifted = 0;
  if (to > from) {
    for (let i = from + 1; i <= to; i++) {
      lifted += heights[i];
      shifts[i] = -heights[from];
    }
  } else if (to < from) {
    for (let i = to; i < from; i++) {
      lifted -= heights[i];
      shifts[i] = heights[from];
    }
  }
  return { lifted, shifts };
}
