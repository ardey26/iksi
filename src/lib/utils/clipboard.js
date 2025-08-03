// Clipboard utility with fallback for older browsers
export async function copyToClipboard(text) {
	if (navigator.clipboard && window.isSecureContext) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch (err) {
			console.warn('Clipboard API failed, falling back to legacy method');
		}
	}
	
	// Fallback for older browsers
	const textArea = document.createElement('textarea');
	textArea.value = text;
	textArea.style.position = 'fixed';
	textArea.style.left = '-999999px';
	textArea.style.top = '-999999px';
	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();
	
	try {
		document.execCommand('copy');
		document.body.removeChild(textArea);
		return true;
	} catch (err) {
		document.body.removeChild(textArea);
		return false;
	}
}
