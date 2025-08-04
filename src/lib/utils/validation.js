// Client-side utilities for URL validation and formatting
export function isValidURL(url) {
	try {
		const prefixed = addPrefix(url.trim());
		const urlObj = new URL(prefixed);
		return ['http:', 'https:'].includes(urlObj.protocol) &&
		       urlObj.hostname.length > 0 &&
		       urlObj.hostname.includes('.') &&
		       urlObj.hostname.split('.').length >= 2;
	} catch {
		return false;
	}
}

export function addPrefix(url) {
	url = url.trim();
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	
	return 'https://' + url;
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
