const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /slackbot/i, /twitterbot/i,
  /facebookexternalhit/i, /linkedinbot/i, /discordbot/i,
  /whatsapp/i, /telegrambot/i, /googlebot/i, /bingbot/i
];

const TABLET_PATTERNS = [
  /iPad/i, /Tablet/i, /SM-T/i, /GT-P/i
];

const MOBILE_PATTERNS = [
  /iPhone/i, /Android/i, /Windows Phone/i, /BlackBerry/i
];

export function detectDevice(userAgent) {
  if (!userAgent) return 'desktop';

  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return 'bot';
  }

  for (const pattern of TABLET_PATTERNS) {
    if (pattern.test(userAgent)) return 'tablet';
  }

  for (const pattern of MOBILE_PATTERNS) {
    if (pattern.test(userAgent)) return 'mobile';
  }

  return 'desktop';
}
