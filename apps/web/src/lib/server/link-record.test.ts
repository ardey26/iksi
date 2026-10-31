import { describe, it, expect } from 'vitest';
import { parseLinkRecord } from '@iksi/core';
import { toLinkRecord } from './link-record';

describe('toLinkRecord', () => {
  it('flags malicious verdicts', () => {
    expect(toLinkRecord({ id: 3, safeVerdict: 'phishing' }, 'https://e.com')).toEqual({
      v: 1,
      id: 3,
      destination: 'https://e.com',
      flagged: true,
      permanent: false
    });
  });

  it.each([null, 'safe', 'pending'])('does not flag %s', (verdict) => {
    const rec = toLinkRecord({ id: 1, safeVerdict: verdict }, 'https://e.com');
    expect(rec.flagged).toBe(false);
    expect(parseLinkRecord(rec)).not.toBeNull();
  });
});
