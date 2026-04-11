import { randomBytes, createHmac, timingSafeEqual, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { prisma } from '$lib/prisma.js';

// Load env vars directly with dotenv to avoid Vite's $ sign interpolation
dotenv.config();

function getSecretKey() {
	const key = process.env.SECRET_KEY;
	if (!key || key.length < 32) {
		throw new Error('SECRET_KEY must be set and at least 32 characters');
	}
	return key;
}

function getPasswordHash() {
	const hash = process.env.ADMIN_PASSWORD_HASH;
	if (!hash) {
		throw new Error('ADMIN_PASSWORD_HASH must be set');
	}
	return hash;
}

function sign(sessionId) {
	return createHmac('sha256', getSecretKey()).update(sessionId).digest('hex');
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
	return bcrypt.compare(password, getPasswordHash());
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createUserSession(userId) {
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
	const session = await prisma.session.create({
		data: { userId, expiresAt }
	});
	const signature = sign(session.id);
	return `${session.id}.${signature}`;
}

export async function verifyUserSession(token) {
	if (!token || typeof token !== 'string') return null;

	const dotIndex = token.indexOf('.');
	if (dotIndex === -1) return null;

	const sessionId = token.slice(0, dotIndex);
	const signature = token.slice(dotIndex + 1);

	const expectedSignature = sign(sessionId);

	try {
		const sigBuffer = Buffer.from(signature, 'hex');
		const expectedBuffer = Buffer.from(expectedSignature, 'hex');
		if (sigBuffer.length !== expectedBuffer.length) return null;
		if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;
	} catch {
		return null;
	}

	const result = await prisma.session.findFirst({
		where: {
			id: sessionId,
			expiresAt: { gt: new Date() }
		},
		select: {
			id: true,
			user: {
				select: {
					id: true,
					provider: true,
					providerId: true,
					email: true,
					name: true,
					avatarUrl: true,
					username: true,
					showPreview: true
				}
			}
		}
	});

	return result?.user ?? null;
}

export async function deleteUserSession(sessionId) {
	await prisma.session.deleteMany({ where: { id: sessionId } });
}

export function hashApiKey(rawKey) {
	return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey() {
	const bytes = randomBytes(32);
	const raw = `ik_${bytes.toString('base64url')}`;
	const hash = hashApiKey(raw);
	const preview = `${raw.slice(0, 7)}...`;
	return { raw, hash, preview };
}
