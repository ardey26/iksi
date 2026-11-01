import { describe, expect, it } from 'vitest';
import { isProfilePath } from './route-kind.js';

describe('isProfilePath', () => {
  it.each(['/@andre', '/@andre/'])('%s is the profile page', (p) => expect(isProfilePath(p)).toBe(true));

  it.each(['/@andre/sale', '/@andre/sale+', '/', '/dashboard', '/AbC'])('%s is not', (p) =>
    expect(isProfilePath(p)).toBe(false)
  );
});
