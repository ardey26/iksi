// Client-side utilities for URL validation and formatting
export function isValidURL(url) {
	try {
		const urlObj = new URL(addPrefix(url));
		return ['http:', 'https:'].includes(urlObj.protocol);
	} catch {
		return false;
	}
}

export function addPrefix(url) {
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return 'https://' + url;
	}
	return url;
}

export function isValidAlias(alias) {
	if (!alias || alias.length < 1 || alias.length > 50) return false;
	return /^[a-zA-Z0-9-_]+$/.test(alias);
}

export function formatURL(url) {
	try {
		const urlObj = new URL(addPrefix(url));
		return urlObj.href;
	} catch {
		return url;
	}
}
