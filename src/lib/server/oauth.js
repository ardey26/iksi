import { Google, Twitter } from 'arctic';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`${name} environment variable is required`);
  return val;
}

export const google = new Google(
  requireEnv('GOOGLE_CLIENT_ID'),
  requireEnv('GOOGLE_CLIENT_SECRET'),
  requireEnv('GOOGLE_REDIRECT_URI')
);

export const twitter = new Twitter(
  requireEnv('TWITTER_CLIENT_ID'),
  requireEnv('TWITTER_CLIENT_SECRET'),
  requireEnv('TWITTER_REDIRECT_URI')
);
