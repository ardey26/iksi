const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.SECRET_KEY || 'iksi-default-secret-key-please-change-in-production';

async function deriveKey(salt) {
	const { scrypt } = await import('crypto');
	const { promisify } = await import('util');
	const scryptAsync = promisify(scrypt);
	return await scryptAsync(SECRET_KEY, salt, 32);
}

export async function encodeURL(url) {
	try {
		const { randomBytes, createCipheriv } = await import('crypto');
		
		const salt = randomBytes(16);
		const iv = randomBytes(16);
		const key = await deriveKey(salt);
		
		const cipher = createCipheriv(ALGORITHM, key, iv);
		
		let encrypted = cipher.update(url, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		
		const authTag = cipher.getAuthTag();
		
		return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
	} catch (error) {
		console.error('URL encoding error:', error);
		return url;
	}
}

export async function decodeURL(encodedUrl) {
	try {
		if (!encodedUrl.includes(':')) {
			return encodedUrl;
		}
		
		const { createDecipheriv } = await import('crypto');
		
		const parts = encodedUrl.split(':');
		
		if (parts.length !== 4) {
			return encodedUrl;
		}
		
		const salt = Buffer.from(parts[0], 'hex');
		const iv = Buffer.from(parts[1], 'hex');
		const authTag = Buffer.from(parts[2], 'hex');
		const encryptedData = parts[3];
		
		const key = await deriveKey(salt);
		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		
		let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		
		return decrypted;
	} catch (error) {
		console.error('URL decoding error:', error);
		return encodedUrl;
	}
}
