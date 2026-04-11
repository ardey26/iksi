export const RESERVED_USERNAMES = [
  'admin', 'www', 'api', 'app', 'static', 'cdn', 'mail', 'smtp', 'ftp',
  'blog', 'help', 'support', 'status', 'docs', 'developer', 'dev',
  'staging', 'test', 'demo', 'beta', 'alpha', 'assets', 'img', 'images'
];

export function normalizeUsername(username) {
  return username.toLowerCase().trim();
}

export function isValidUsername(username) {
  const normalized = normalizeUsername(username);

  if (normalized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }
  if (normalized.length > 20) {
    return { valid: false, error: 'Username must be at most 20 characters' };
  }

  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and hyphens' };
  }

  if (normalized.startsWith('-')) {
    return { valid: false, error: 'Username cannot start with a hyphen' };
  }
  if (normalized.endsWith('-')) {
    return { valid: false, error: 'Username cannot end with a hyphen' };
  }

  if (normalized.includes('--')) {
    return { valid: false, error: 'Username cannot contain consecutive hyphens' };
  }

  if (RESERVED_USERNAMES.includes(normalized)) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}
