import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import SortableHarness from './tests/SortableHarness.svelte';
import { LONG_PRESS_MS, TOUCH_SLOP, moveItem, offsets, pressDecision, targetIndex } from './sortable.js';
import { ICONS } from './Icon.svelte';

const order = () =>
  within(screen.getByRole('list', { name: 'Payment methods' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent.trim());

const live = () => document.querySelector('[aria-live="assertive"]');

async function key(el, k) {
  await fireEvent.keyDown(el, { key: k });
}

describe('pressDecision (long-press threshold)', () => {
  it('lifts a touch only after it rests for the long-press time', () => {
    expect(pressDecision({ pointerType: 'touch', elapsed: 0, distance: 0 })).toBe('wait');
    expect(pressDecision({ pointerType: 'touch', elapsed: LONG_PRESS_MS - 1, distance: 2 })).toBe('wait');
    expect(pressDecision({ pointerType: 'touch', elapsed: LONG_PRESS_MS, distance: 2 })).toBe('lift');
  });

  it('gives a touch that moves first back to scrolling', () => {
    expect(pressDecision({ pointerType: 'touch', elapsed: 100, distance: TOUCH_SLOP + 1 })).toBe('cancel');
    expect(pressDecision({ pointerType: 'touch', elapsed: LONG_PRESS_MS + 50, distance: TOUCH_SLOP + 1 })).toBe('cancel');
  });

  it('lifts a mouse or pen as soon as it moves, without waiting', () => {
    expect(pressDecision({ pointerType: 'mouse', elapsed: 0, distance: 1 })).toBe('wait');
    expect(pressDecision({ pointerType: 'mouse', elapsed: 0, distance: 3 })).toBe('lift');
    expect(pressDecision({ pointerType: 'pen', elapsed: 10, distance: 5 })).toBe('lift');
  });
});

describe('reorder geometry', () => {
  it('moves an item', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('finds the landing slot from row midpoints', () => {
    const mids = [28, 84, 140, 196];
    expect(targetIndex(mids, 0, 28)).toBe(0);
    expect(targetIndex(mids, 0, 90)).toBe(1);
    expect(targetIndex(mids, 0, 500)).toBe(3);
    expect(targetIndex(mids, 3, 80)).toBe(1);
    expect(targetIndex(mids, 3, -10)).toBe(0);
  });

  it('opens a slot by shifting passed rows by the lifted row height', () => {
    expect(offsets([56, 56, 56], 0, 2)).toEqual({ lifted: 112, shifts: [0, -56, -56] });
    expect(offsets([56, 60, 56], 2, 0)).toEqual({ lifted: -116, shifts: [56, 56, 0] });
    expect(offsets([56, 56], 1, 1)).toEqual({ lifted: 0, shifts: [0, 0] });
  });
});

describe('SortableList', () => {
  it('gives each row a named grip handle and no arrow buttons', () => {
    render(SortableHarness);
    const handle = screen.getByRole('button', { name: 'Reorder GCash' });
    expect(handle).toHaveAccessibleDescription(/Space or Enter to lift/);
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /move .*(up|down)/i })).toBeNull();
    expect(ICONS['arrow-up']).toBeUndefined();
    expect(ICONS['arrow-down']).toBeUndefined();
  });

  it('lifts, moves and drops with the keyboard, announcing each step', async () => {
    const onReorder = vi.fn();
    render(SortableHarness, { props: { onReorder } });
    const handle = screen.getByRole('button', { name: 'Reorder GCash' });
    handle.focus();

    await key(handle, ' ');
    await waitFor(() => expect(live()).toHaveTextContent('Lifted GCash, position 1 of 4'));

    await key(handle, 'ArrowDown');
    await waitFor(() => expect(live()).toHaveTextContent('Moved to position 2 of 4'));
    await key(handle, 'ArrowDown');
    await waitFor(() => expect(live()).toHaveTextContent('Moved to position 3 of 4'));
    expect(onReorder).not.toHaveBeenCalled();

    await key(handle, 'Enter');
    await waitFor(() => expect(live()).toHaveTextContent('Dropped GCash at position 3 of 4'));
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.calls[0][0]).toMatchObject({ ids: ['maya', 'bpi', 'gcash', 'paypal'], id: 'gcash', from: 0, to: 2 });
    expect(order()).toEqual(['Maya', 'BPI', 'GCash', 'PayPal']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reorder GCash' })));
  });

  it('stops at the ends of the list', async () => {
    const onReorder = vi.fn();
    render(SortableHarness, { props: { onReorder } });
    const handle = screen.getByRole('button', { name: 'Reorder BPI' });
    await key(handle, 'Enter');
    await key(handle, 'ArrowUp');
    await key(handle, 'ArrowUp');
    await key(handle, 'ArrowUp');
    await key(handle, ' ');
    expect(onReorder.mock.calls[0][0].ids).toEqual(['bpi', 'gcash', 'maya', 'paypal']);
  });

  it('cancels on Escape without reordering, and Escape goes no further', async () => {
    const onReorder = vi.fn();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    render(SortableHarness, { props: { onReorder } });
    const handle = screen.getByRole('button', { name: 'Reorder Maya' });
    await key(handle, ' ');
    await key(handle, 'ArrowDown');
    await key(handle, 'Escape');
    await waitFor(() => expect(live()).toHaveTextContent('Cancelled. Maya is back at position 2 of 4'));
    expect(onReorder).not.toHaveBeenCalled();
    expect(order()).toEqual(['GCash', 'Maya', 'BPI', 'PayPal']);
    expect(outer.mock.calls.some(([e]) => e.key === 'Escape')).toBe(false);
    document.removeEventListener('keydown', outer);
  });

  it('does not emit when dropped where it started', async () => {
    const onReorder = vi.fn();
    render(SortableHarness, { props: { onReorder } });
    const handle = screen.getByRole('button', { name: 'Reorder PayPal' });
    await key(handle, ' ');
    await key(handle, 'ArrowDown');
    await key(handle, ' ');
    expect(onReorder).not.toHaveBeenCalled();
    await waitFor(() => expect(live()).toHaveTextContent('Dropped PayPal at position 4 of 4'));
  });

  it('cancels a keyboard lift when focus leaves the handle', async () => {
    render(SortableHarness);
    const handle = screen.getByRole('button', { name: 'Reorder GCash' });
    handle.focus();
    await key(handle, ' ');
    await key(handle, 'ArrowDown');
    await fireEvent.blur(handle);
    await waitFor(() => expect(live()).toHaveTextContent(/^Cancelled/));
    expect(order()).toEqual(['GCash', 'Maya', 'BPI', 'PayPal']);
  });
});
