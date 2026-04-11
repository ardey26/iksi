import { Google, Twitter } from 'arctic';
import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`${name} environment variable is required`);
  return val;
}

let _google;
export function google() {
  if (!_google) {
    _google = new Google(
      requireEnv('GOOGLE_CLIENT_ID'),
      requireEnv('GOOGLE_CLIENT_SECRET'),
      requireEnv('GOOGLE_REDIRECT_URI')
    );
  }
  return _google;
}

let _twitter;
export function twitter() {
  if (!_twitter) {
    _twitter = new Twitter(
      requireEnv('TWITTER_CLIENT_ID'),
      requireEnv('TWITTER_CLIENT_SECRET'),
      requireEnv('TWITTER_REDIRECT_URI')
    );
  }
  return _twitter;
}
