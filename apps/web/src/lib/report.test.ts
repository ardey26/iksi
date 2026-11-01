import { describe, it, expect } from 'vitest';
import { isReportReason, parseReportLink, reasonLabel, REPORT_REASONS, reportHref } from './report';

describe('parseReportLink', () => {
  it.each([
    ['abc', 'abc'],
    ['abc+', 'abc'],
    ['/abc', 'abc'],
    ['  iksi.app/abc  ', 'abc'],
    ['iksi.app/abc+', 'abc'],
    ['www.iksi.app/abc', 'abc'],
    ['https://www.iksi.app/abc?s=profile', 'abc'],
    ['http://iksi.app/AbC', 'AbC'],
    ['https://iksi.app/abc+stats', 'abc'],
    ['@Andre/sale', '@andre/sale'],
    ['iksi.app/@andre/sale', '@andre/sale'],
    ['https://andre.iksi.app/sale', '@andre/sale'],
    ['andre.iksi.app/sale+', '@andre/sale']
  ])('%s names %s', (input, slug) => expect(parseReportLink(input)).toBe(slug));

  it.each([
    '',
    '   ',
    'https://google.com/abc',
    'iksi.app.evil.com/abc',
    'iksi.app/',
    'iksi.app/api/shorten',
    'iksi.app/report',
    'iksi.app/@andre',
    'andre.iksi.app/',
    'www.iksi.app/admin',
    'javascript:alert(1)',
    'ftp://iksi.app/abc',
    'abc/def',
    'localhost:5179/abc',
    'iksi.app/' + 'a'.repeat(400)
  ])('%s is not a short link', (input) => expect(parseReportLink(input)).toBeNull());

  it('reads localhost links only in dev', () => {
    expect(parseReportLink('http://localhost:5179/abc', true)).toBe('abc');
    expect(parseReportLink('http://localhost:5179/abc', false)).toBeNull();
  });
});

describe('reasons', () => {
  it('are the five agreed, in order, in sentence case', () =>
    expect(REPORT_REASONS.map((r) => r.label)).toEqual(['Phishing or scam', 'Malware', 'Spam', 'Illegal content', 'Other']));
  it('validate', () => {
    expect(isReportReason('malware')).toBe(true);
    expect(isReportReason('Malware')).toBe(false);
    expect(isReportReason(undefined)).toBe(false);
  });
  it('label unknown values as Other', () => expect(reasonLabel('zzz')).toBe('Other'));
});

describe('reportHref', () => {
  it.each([
    ['https://www.iksi.app/abc', '/report?link=iksi.app%2Fabc'],
    ['https://www.iksi.app/abc+', '/report?link=iksi.app%2Fabc'],
    ['https://www.iksi.app/@andre/sale', '/report?link=iksi.app%2F%40andre%2Fsale'],
    ['https://andre.iksi.app/sale', 'https://www.iksi.app/report?link=andre.iksi.app%2Fsale']
  ])('%s reports at %s', (from, href) => expect(reportHref(new URL(from))).toBe(href));

  it('round-trips through parseReportLink', () => {
    for (const from of ['https://www.iksi.app/abc+', 'https://andre.iksi.app/sale', 'https://www.iksi.app/@andre/sale']) {
      const link = new URL(reportHref(new URL(from)), 'https://www.iksi.app').searchParams.get('link') as string;
      expect(parseReportLink(link)).not.toBeNull();
    }
  });
});
