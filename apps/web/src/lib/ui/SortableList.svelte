<script>
  // The one way to reorder anything. Each row renders a <DragHandle {handle} />
  // from the slot props:
  //   - mouse or pen: drag the handle;
  //   - touch: long-press the handle (250ms), then drag; a swipe still scrolls;
  //   - keyboard on the handle: Space or Enter lifts, arrows move, Space or
  //     Enter drops, Escape cancels.
  // Emits one `reorder` with the new id order; `items` is bindable.
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import { LONG_PRESS_MS, moveItem, offsets, pressDecision, targetIndex } from './sortable.js';
  import { reducedMotion } from './motion.js';
  import { uid } from './uid.js';

  export let items = [];
  /** Property holding each item's id. */
  export let key = 'id';
  /** Name of an item, for announcements and the handle's label. */
  export let name = (item) => String(item[key]);
  /** Accessible name for the list. */
  export let label = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher();
  const id = uid('sortable');

  let listEl;
  let lineEl;
  let message = '';
  // Handle elements by item id, for refocusing after a keyboard drop. Not state.
  const handles = {};

  /** @type {null | { id: any, from: number, to: number, mode: 'pointer' | 'keyboard', rows: HTMLElement[], heights: number[], tops: number[], mids: number[], listTop: number, dy: number }} */
  let drag = null;
  /** A press that has not lifted yet. */
  let press = null;
  /** pointer | keyboard while a row is lifted. */
  let sorting = undefined;

  $: count = items.length;

  function announce(text) {
    // Re-set so the same text twice is still announced.
    message = '';
    tick().then(() => (message = text));
  }

  function rowsInOrder() {
    return Array.from(listEl.children).filter((el) => el.tagName === 'LI');
  }

  function itemName(itemId) {
    const item = items.find((x) => x[key] === itemId);
    return item ? name(item) : '';
  }

  const transition = () =>
    reducedMotion() ? 'none' : 'transform var(--duration-normal) var(--ease-out)';

  function begin(itemId, mode, startY = 0) {
    const from = items.findIndex((x) => x[key] === itemId);
    if (from < 0 || disabled) return false;
    const rows = rowsInOrder();
    const rects = rows.map((r) => r.getBoundingClientRect());
    drag = {
      id: itemId,
      from,
      to: from,
      mode,
      rows,
      heights: rects.map((r) => r.height),
      tops: rects.map((r) => r.top),
      mids: rects.map((r) => r.top + r.height / 2),
      listTop: listEl.getBoundingClientRect().top,
      startY,
      dy: 0
    };
    sorting = mode;
    rows[from]?.setAttribute('data-sort-lifted', '');
    rows.forEach((r, i) => {
      r.style.transition = i === from && mode === 'pointer' ? 'none' : transition();
    });
    placeLine();
    announce(`Lifted ${name(items[from])}, position ${from + 1} of ${count}`);
    return true;
  }

  function apply() {
    const { lifted, shifts } = offsets(drag.heights, drag.from, drag.to);
    drag.rows.forEach((r, i) => {
      if (i === drag.from) {
        r.style.transform = `translateY(${drag.mode === 'pointer' ? drag.dy : lifted}px)`;
      } else {
        r.style.transform = shifts[i] ? `translateY(${shifts[i]}px)` : '';
      }
    });
    placeLine();
  }

  function placeLine() {
    if (!lineEl || !drag) return;
    const { lifted } = offsets(drag.heights, drag.from, drag.to);
    lineEl.style.transform = `translateY(${drag.tops[drag.from] - drag.listTop + lifted - 1}px)`;
  }

  function cleanup(animate) {
    if (!drag) return;
    const rows = drag.rows;
    rows.forEach((r) => {
      r.style.transition = animate ? transition() : 'none';
      r.style.transform = '';
      r.removeAttribute('data-sort-lifted');
    });
    sorting = undefined;
    drag = null;
    requestAnimationFrame(() => rows.forEach((r) => (r.style.transition = '')));
  }

  async function drop() {
    if (!drag) return;
    const { id: itemId, from, to, mode } = drag;
    const who = itemName(itemId);
    cleanup(false);
    if (to !== from) {
      items = moveItem(items, from, to);
      dispatch('reorder', { ids: items.map((x) => x[key]), id: itemId, from, to });
    }
    announce(`Dropped ${who} at position ${to + 1} of ${count}`);
    if (mode === 'keyboard') {
      await tick();
      handles[itemId]?.focus({ preventScroll: true });
    }
  }

  function cancel() {
    if (!drag) return;
    const { id: itemId, from } = drag;
    cleanup(true);
    announce(`Cancelled. ${itemName(itemId)} is back at position ${from + 1} of ${count}`);
  }

  // Keyboard ------------------------------------------------------------------

  function onKeydown(e, itemId) {
    const lifted = drag && drag.id === itemId && drag.mode === 'keyboard';
    if (!lifted) {
      if ((e.key === ' ' || e.key === 'Enter') && !drag) {
        e.preventDefault();
        begin(itemId, 'keyboard');
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const to = Math.max(0, Math.min(count - 1, drag.to + (e.key === 'ArrowUp' ? -1 : 1)));
      if (to === drag.to) return;
      drag.to = to;
      apply();
      announce(`Moved to position ${to + 1} of ${count}`);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      drop();
    } else if (e.key === 'Escape') {
      // Escape belongs to the reorder, not to an enclosing sheet.
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  }

  function onBlur(itemId) {
    if (drag && drag.id === itemId && drag.mode === 'keyboard') cancel();
  }

  // Pointer -------------------------------------------------------------------

  function onPointerdown(e, itemId) {
    if (disabled || drag || e.button > 0) return;
    if (e.pointerType !== 'touch') e.preventDefault(); // no text selection
    press = { id: itemId, pointerId: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, at: performance.now(), timer: 0 };
    if (e.pointerType === 'touch') {
      press.timer = setTimeout(() => decide(press?.x ?? 0, press?.y ?? 0, true), LONG_PRESS_MS);
    }
    window.addEventListener('pointermove', onPointermove);
    window.addEventListener('pointerup', onPointerup);
    window.addEventListener('pointercancel', onPointercancel);
    window.addEventListener('touchmove', onTouchmove, { passive: false });
  }

  function decide(x, y, timerFired = false) {
    if (!press) return;
    const elapsed = timerFired ? LONG_PRESS_MS : performance.now() - press.at;
    const distance = Math.hypot(x - press.x, y - press.y);
    const verdict = pressDecision({ pointerType: press.type, elapsed, distance });
    if (verdict === 'cancel') return endPress();
    if (verdict === 'lift') {
      const { id: itemId, y: startY, type } = press;
      clearTimeout(press.timer);
      press = { ...press, lifted: true };
      if (begin(itemId, 'pointer', startY) && type === 'touch') navigator.vibrate?.(8);
    }
  }

  function onPointermove(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!drag) return decide(e.clientX, e.clientY);
    const last = drag.rows.length - 1;
    const min = drag.tops[0] - drag.tops[drag.from];
    const max = drag.tops[last] + drag.heights[last] - (drag.tops[drag.from] + drag.heights[drag.from]);
    drag.dy = Math.max(min, Math.min(max, e.clientY - drag.startY));
    const to = targetIndex(drag.mids, drag.from, drag.mids[drag.from] + drag.dy);
    if (to !== drag.to) {
      drag.to = to;
      announce(`Moved to position ${to + 1} of ${count}`);
    }
    apply();
  }

  // Once lifted, a touch drags the row instead of scrolling the page.
  function onTouchmove(e) {
    if (drag && drag.mode === 'pointer') e.preventDefault();
  }

  function onPointerup(e) {
    if (press && e.pointerId !== press.pointerId) return;
    const lifted = drag && drag.mode === 'pointer';
    endPress();
    if (lifted) drop();
  }

  function onPointercancel() {
    const lifted = drag && drag.mode === 'pointer';
    endPress();
    if (lifted) cancel();
  }

  function endPress() {
    if (press) clearTimeout(press.timer);
    press = null;
    window.removeEventListener('pointermove', onPointermove);
    window.removeEventListener('pointerup', onPointerup);
    window.removeEventListener('pointercancel', onPointercancel);
    window.removeEventListener('touchmove', onTouchmove);
  }

  onDestroy(() => {
    if (typeof window !== 'undefined') endPress();
  });

  // What each row's DragHandle needs.
  function handleFor(item) {
    const itemId = item[key];
    return {
      label: `Reorder ${name(item)}`,
      describedby: `${id}-help`,
      disabled,
      register: (el) => {
        handles[itemId] = el;
        return () => {
          if (handles[itemId] === el) delete handles[itemId];
        };
      },
      keydown: (e) => onKeydown(e, itemId),
      blur: () => onBlur(itemId),
      pointerdown: (e) => onPointerdown(e, itemId),
      contextmenu: (e) => e.preventDefault()
    };
  }
</script>

<div class="sortable">
  <ul class="list" role="list" aria-label={label} data-sorting={sorting} bind:this={listEl}>
    {#each items as item, index (item[key])}
      <slot {item} {index} handle={handleFor(item)} />
    {/each}
  </ul>
  <span class="line" bind:this={lineEl} aria-hidden="true"></span>
  <p id="{id}-help" class="sr-only">
    Press Space or Enter to lift, the arrow keys to move, Space or Enter to drop, or Escape to cancel.
    On a touch screen, press and hold to lift.
  </p>
  <p class="sr-only" aria-live="assertive" aria-atomic="true">{message}</p>
</div>

<style>
  .sortable {
    position: relative;
    border-radius: inherit;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-radius: inherit;
  }
  .list > :global(li + li) { border-top: 1px solid var(--border); }
  .list[data-sorting] > :global(li) {
    position: relative;
    user-select: none;
  }
  .list[data-sorting] > :global(li[data-sort-lifted]) {
    z-index: 2;
    background-color: var(--surface);
    border-top-color: transparent;
    border-radius: var(--radius-control);
    box-shadow: var(--overlay-shadow);
  }
  .list[data-sorting='pointer'] > :global(li[data-sort-lifted]) { cursor: grabbing; }

  .line {
    position: absolute;
    top: 0;
    left: 12px;
    right: 12px;
    z-index: 1;
    height: 2px;
    border-radius: 1px;
    background-color: var(--accent);
    opacity: 0;
    pointer-events: none;
  }
  .sortable:has(.list[data-sorting='pointer']) .line { opacity: 1; }
</style>
