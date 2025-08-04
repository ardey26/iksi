export function addPrefix(url) {
	url = url.trim();
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}
	return 'https://' + url;
}

export function isValidURL(url) {
	try {
		const prefixed = addPrefix(url.trim());
		const urlObj = new URL(prefixed);
		const hostname = urlObj.hostname;
		
		return ['http:', 'https:'].includes(urlObj.protocol) &&
		       hostname.length > 0 &&
		       hostname.includes('.') &&
		       !hostname.startsWith('.') &&
		       !hostname.endsWith('.') &&
		       hostname.split('.').length >= 2 &&
		       hostname.split('.').every(part => part.length > 0);
	} catch {
		return false;
	}
}

export function isValidURLServer(prefixedURL) {
	try {
		const url = new URL(prefixedURL);
		const hostname = url.hostname;
		
		return ['http:', 'https:'].includes(url.protocol) && 
		       hostname.length > 0 && 
		       hostname.includes('.') &&
		       !hostname.startsWith('.') &&
		       !hostname.endsWith('.') &&
		       !hostname.includes('localhost') && 
		       !hostname.includes('127.0.0.1') &&
		       !hostname.includes('0.0.0.0') &&
		       hostname.split('.').length >= 2 &&
		       hostname.split('.').every(part => part.length > 0);
	} catch {
		return false;
	}
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
