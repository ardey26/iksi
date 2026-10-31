import { describe, it, expect } from 'vitest';
import { parseUserAgent } from './agent';

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
const EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
const BOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

describe('parseUserAgent', () => {
	it('Chrome on Windows is desktop', () => {
		expect(parseUserAgent(CHROME_WIN)).toEqual({ browser: 'Chrome', device: 'desktop', os: 'windows' });
	});
	it('iPhone Safari is mobile on ios', () => {
		expect(parseUserAgent(IPHONE)).toEqual({ browser: 'Safari', device: 'mobile', os: 'ios' });
	});
	it('iPad is tablet on ios', () => {
		expect(parseUserAgent(IPAD)).toEqual({ browser: 'Safari', device: 'tablet', os: 'ios' });
	});
	it('Firefox on X11 Linux is desktop on linux', () => {
		expect(parseUserAgent(FIREFOX)).toEqual({ browser: 'Firefox', device: 'desktop', os: 'linux' });
	});
	it('Edge matches before Chrome', () => {
		expect(parseUserAgent(EDGE)).toMatchObject({ browser: 'Edge', device: 'desktop' });
	});
	it('Googlebot is a bot with os other', () => {
		expect(parseUserAgent(BOT)).toEqual({ browser: 'Other', device: 'bot', os: 'other' });
	});
	it('Android Chrome is mobile on android', () => {
		expect(parseUserAgent(ANDROID)).toEqual({ browser: 'Chrome', device: 'mobile', os: 'android' });
	});
	it('Mac Safari is desktop on macos', () => {
		expect(parseUserAgent(MAC)).toEqual({ browser: 'Safari', device: 'desktop', os: 'macos' });
	});
	it('null and empty are desktop/other', () => {
		const empty = { device: 'desktop', os: 'other', browser: 'Other' };
		expect(parseUserAgent(null)).toEqual(empty);
		expect(parseUserAgent('')).toEqual(empty);
	});
});
