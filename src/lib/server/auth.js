import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcrypt';
import { SECRET_KEY, ADMIN_PASSWORD_HASH } from '$env/static/private';

if (!SECRET_KEY || SECRET_KEY.length < 32) {
	throw new Error('SECRET_KEY must be set and at least 32 characters');
}

if (!ADMIN_PASSWORD_HASH) {
	throw new Error('ADMIN_PASSWORD_HASH must be set');
}

function sign(sessionId) {
	return createHmac('sha256', SECRET_KEY).update(sessionId).digest('hex');
}

export function createSession() {
	const sessionId = randomBytes(32).toString('hex');
	const signature = sign(sessionId);
	return `${sessionId}.${signature}`;
}

export function verifySession(token) {
	if (!token || typeof token !== 'string') {
		return false;
	}

	const parts = token.split('.');
	if (parts.length !== 2) {
		return false;
	}

	const [sessionId, signature] = parts;

	if (sessionId.length !== 64 || signature.length !== 64) {
		return false;
	}

	const expectedSignature = sign(sessionId);

	try {
		return timingSafeEqual(
			Buffer.from(signature, 'hex'),
			Buffer.from(expectedSignature, 'hex')
		);
	} catch {
		return false;
	}
}

export async function verifyPassword(password) {
	if (!password) {
		return false;
	}
	return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
}
