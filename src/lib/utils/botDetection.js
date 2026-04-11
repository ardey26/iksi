export const UNFURLER_PATTERNS = [
  /Slackbot/i,
  /Twitterbot/i,
  /facebookexternalhit/i,
  /LinkedInBot/i,
  /Discordbot/i,
  /WhatsApp/i,
  /TelegramBot/i
];

export function isUnfurler(userAgent) {
  if (!userAgent) return false;

  for (const pattern of UNFURLER_PATTERNS) {
    if (pattern.test(userAgent)) return true;
  }

  return false;
}
