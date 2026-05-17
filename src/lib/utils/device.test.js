import { describe, it, expect } from 'vitest';
import { detectDevice } from './device.js';

describe('detectDevice', () => {
  it('detects mobile devices', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')).toBe('mobile');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 10; SM-G950F)')).toBe('mobile');
  });

  it('detects tablets', () => {
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')).toBe('tablet');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 10; SM-T860)')).toBe('tablet');
  });

  it('detects bots', () => {
    expect(detectDevice('Slackbot-LinkExpanding 1.0')).toBe('bot');
    expect(detectDevice('Twitterbot/1.0')).toBe('bot');
    expect(detectDevice('facebookexternalhit/1.1')).toBe('bot');
    expect(detectDevice('Googlebot/2.1')).toBe('bot');
  });

  it('detects desktop as default', () => {
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('handles null/undefined', () => {
    expect(detectDevice(null)).toBe('desktop');
    expect(detectDevice(undefined)).toBe('desktop');
    expect(detectDevice('')).toBe('desktop');
  });
});
