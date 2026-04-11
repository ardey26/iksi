// Environment configuration
export const isDev = process.env.NODE_ENV === 'development';
export const isProd = process.env.NODE_ENV === 'production';

// Domain configuration
export const DOMAIN = {
	base: isProd ? 'iksi.app' : 'localhost:5173',
	protocol: isProd ? 'https' : 'http'
};

// Helper to construct profile URL
export function getProfileUrl(username) {
	return `${DOMAIN.protocol}://${username}.${DOMAIN.base}`;
}

// API endpoints
export const API_BASE = '/api';

// Rate limiting config
export const RATE_LIMIT = {
	requests: isProd ? 20 : 100, // More lenient in dev
	windowMs: 60000 // 1 minute
};

// Short URL config
export const SHORT_URL = {
	length: 7,
	retries: 5
};

// UI config
export const UI = {
	errorTimeout: 5000,
	successTimeout: 2000
};
