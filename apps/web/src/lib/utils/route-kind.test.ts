import { describe, expect, it } from 'vitest';
import { isDashboardPath, isProfilePath } from './route-kind.js';

describe('isProfilePath', () => {
  it.each(['/@andre', '/@andre/'])('%s is the profile page', (p) => expect(isProfilePath(p)).toBe(true));

  it.each(['/@andre/sale', '/@andre/sale+', '/', '/dashboard', '/AbC'])('%s is not', (p) =>
    expect(isProfilePath(p)).toBe(false)
  );
});

describe('isDashboardPath', () => {
  it.each(['/dashboard', '/dashboard/links', '/dashboard/profile'])('%s is a dashboard page', (p) =>
    expect(isDashboardPath(p)).toBe(true)
  );

  it.each(['/', '/dashboardx', '/@andre'])('%s is not', (p) => expect(isDashboardPath(p)).toBe(false));
});
