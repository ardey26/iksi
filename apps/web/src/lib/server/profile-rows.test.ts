import { describe, it, expect } from 'vitest';
import { PUBLIC_ROW_WHERE, publicRows } from './profile-rows';

describe('public profile rows', () => {
  it('asks the database for enabled rows that are not quarantined', () => {
    expect(PUBLIC_ROW_WHERE).toEqual({ enabled: true, quarantined: false });
  });

  it('drops rows pointing at a one-time link and keeps the order of the rest', () => {
    const rows = [
      { id: 1, link: { oneTime: false } },
      { id: 2, link: { oneTime: true } },
      { id: 3, link: null },
      { id: 4, link: { oneTime: false } }
    ];
    expect(publicRows(rows).map((r) => r.id)).toEqual([1, 3, 4]);
  });
});
