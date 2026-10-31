export async function createURLHash(url) {
	try {
		const { createHash } = await import('crypto');
		return createHash('sha256').update(url).digest('hex');
	} catch (error) {
		console.error('Error creating URL hash:', error);
		return null;
	}
}
