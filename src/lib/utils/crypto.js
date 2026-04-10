import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY || SECRET_KEY.length < 64) {
	throw new Error('SECRET_KEY environment variable must be set and at least 64 hex characters (32 bytes)');
}

// Pre-derive key at module load for new encryptions (fast path)
const ENCRYPTION_KEY = Buffer.from(SECRET_KEY.slice(0, 64), 'hex');

// For legacy URLs that used per-URL salt with scrypt
const scryptAsync = promisify(scrypt);

async function deriveLegacyKey(salt) {
	return await scryptAsync(SECRET_KEY, salt, 32);
}

// New fast encode - no scrypt, key pre-derived
export function encodeURL(url) {
	try {
		const iv = randomBytes(16);
		const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

		let encrypted = cipher.update(url, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		const authTag = cipher.getAuthTag();

		// Format: iv:authTag:encrypted (3 parts = new format)
		return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
	} catch (error) {
		console.error('URL encoding error:', error);
		return url;
	}
}

// Decode handles both legacy (4 parts with scrypt) and new format (3 parts)
export async function decodeURL(encodedUrl) {
	try {
		if (!encodedUrl.includes(':')) {
			return encodedUrl;
		}

		const parts = encodedUrl.split(':');

		if (parts.length === 4) {
			// Legacy format: salt:iv:authTag:encrypted (requires scrypt)
			const salt = Buffer.from(parts[0], 'hex');
			const iv = Buffer.from(parts[1], 'hex');
			const authTag = Buffer.from(parts[2], 'hex');
			const encryptedData = parts[3];

			const key = await deriveLegacyKey(salt);
			const decipher = createDecipheriv(ALGORITHM, key, iv);
			decipher.setAuthTag(authTag);

			let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
			decrypted += decipher.final('utf8');

			return decrypted;
		} else if (parts.length === 3) {
			// New format: iv:authTag:encrypted (fast, pre-derived key)
			const iv = Buffer.from(parts[0], 'hex');
			const authTag = Buffer.from(parts[1], 'hex');
			const encryptedData = parts[2];

			const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
			decipher.setAuthTag(authTag);

			let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
			decrypted += decipher.final('utf8');

			return decrypted;
		}

		return encodedUrl;
	} catch (error) {
		console.error('URL decoding error:', error);
		return encodedUrl;
	}
}
