// DESIGN.md › App UI system, checked over every source file under src/:
// no middle-dot separators, no legacy `d-` dashboard classes, and one
// reorder pattern (SortableList + DragHandle), never up/down arrow buttons.
import { describe, it, expect } from 'vitest';

const all: Record<string, string> = import.meta.glob(['/src/**/*.{svelte,ts,js,css,html}', '!/src/**/*.test.*', '!/src/**/tests/**'], {
  query: '?raw',
  import: 'default',
  eager: true
});

describe('source guards', () => {
  it('covers the source tree', () => {
    expect(Object.keys(all).length).toBeGreaterThan(100);
  });

  it('has no middle dots', () => {
    const hits = Object.entries(all).filter(([, s]) => /·|&middot;|&#183;|&#xb7;|\\u00b7/i.test(s));
    expect(hits.map(([p]) => p)).toEqual([]);
  });

  it('has no legacy d- classes', () => {
    const legacy = /class="[^"]*(?<![\w-])d-[a-z]|class:d-[a-z]|(?<![\w-])\.d-[a-z][\w-]*\s*[{,:]/;
    const hits = Object.entries(all).filter(([, s]) => legacy.test(s));
    expect(hits.map(([p]) => p)).toEqual([]);
  });

  it('has no arrow reorder controls', () => {
    const arrows = /icons\/(arrow-up|arrow-down|chevron-up|move-up|move-down)['"]|Move (up|down)|moveUp|moveDown/i;
    const hits = Object.entries(all).filter(([, s]) => arrows.test(s));
    expect(hits.map(([p]) => p)).toEqual([]);
  });
});
