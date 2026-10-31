export type Device = 'mobile' | 'desktop' | 'tablet';
export type Os = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other';
export interface AgentInfo {
	device: Device | 'bot';
	os: Os;
	browser: string;
}

const BOT_RE = /bot|crawl|spider|slurp|fetch|monitor/i;

function osOf(ua: string): Os {
	if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
	if (/Android/.test(ua)) return 'android';
	if (/Windows/.test(ua)) return 'windows';
	if (/Macintosh|Mac OS X/.test(ua)) return 'macos';
	if (/Linux|X11/.test(ua)) return 'linux';
	return 'other';
}

/** Coarse device, OS and browser from a User-Agent. Bots are never mobile, desktop or tablet. */
export function parseUserAgent(ua: string | null): AgentInfo {
	if (!ua) return { device: 'desktop', os: 'other', browser: 'Other' };
	if (BOT_RE.test(ua)) return { device: 'bot', os: 'other', browser: 'Other' };

	const device: Device = /iPad|Tablet/i.test(ua)
		? 'tablet'
		: /Mobi|Android/i.test(ua)
			? 'mobile'
			: 'desktop';

	let browser = 'Other';
	if (/Edg\//.test(ua)) browser = 'Edge';
	else if (/Firefox\//.test(ua)) browser = 'Firefox';
	else if (/Chrome\//.test(ua)) browser = 'Chrome';
	else if (/Safari\//.test(ua)) browser = 'Safari';

	return { device, os: osOf(ua), browser };
}

/** Referrer hostname without "www.", or null when it is not an http(s) URL. */
export function referrerHost(referer: string | null): string | null {
	if (!referer) return null;
	try {
		const u = new URL(referer);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return u.hostname.replace(/^www\./i, '') || null;
	} catch {
		return null;
	}
}
