// Copy for the /features pages. Every statement about iksi here was read from
// the code (the file is named beside each claim in the SDD report). Plan
// labels are never written here: planLabel() reads them from facts.js, and the
// page also prints the iksi fact values named in `factIds`.
import { FEATURES } from './facts.js';

/**
 * @typedef {{
 *   title: string,
 *   label: string,
 *   description: string,
 *   answer: string,
 *   steps: string[],
 *   limit: string,
 *   example?: { shortURL: string, note: string },
 *   image?: string,
 *   faq: { q: string, a: string }[],
 *   factIds: string[]
 * }} FeatureCopy
 */

/** @type {Record<string, FeatureCopy>} */
export const FEATURE_PAGES = {
  'link-in-bio': {
    title: 'Link-in-bio page where every link is smart | iksi',
    label: 'Link-in-bio',
    description:
      'Build an iksi link-in-bio page at iksi.app/@handle. Every row is a short link that can route by country or device, ask for a password, or expire.',
    answer:
      'A link-in-bio page on iksi lives at iksi.app/@yourhandle. Every row is an iksi short link, so each row can also route visitors by country or device, ask for a password, or expire.',
    steps: [
      'Sign in with X or Google, then claim your handle.',
      'Open Links, paste a Long URL under New link, add a Title and switch on Show on your page.',
      'Open Profile to set your display name, bio, accent and background, then select Save changes.',
      'Select View page to check it, then share iksi.app/@yourhandle.'
    ],
    limit: 'A bio is up to 200 characters, and a handle is 3 to 30 letters, numbers or hyphens.',
    faq: [
      {
        q: 'Do I need an account for a link-in-bio page?',
        a: 'Yes. Sign in with X or Google and claim a handle. Short links on their own need no account.'
      },
      {
        q: 'Can a row open a one-time link?',
        a: 'No. A one-time link opens once, so the first visitor to your page would use it up. The dashboard will not add one to your page.'
      },
      {
        q: 'Can I use my own domain?',
        a: 'No. Every profile and short link lives on iksi.app. Custom domains are not offered.'
      }
    ],
    factIds: ['link-in-bio']
  },
  'smart-routing': {
    title: 'Smart link routing by country and device | iksi',
    label: 'Smart routing',
    description:
      'Send visitors of one iksi link to different destinations by country, continent, device, OS, referrer or time of day, with up to 20 rules per link.',
    answer:
      'Smart routing sends visitors of one short link to different destinations. A rule matches on country, continent, device, operating system, referrer or time of day. The first rule that matches wins, and everyone else goes to the link destination.',
    steps: [
      'Sign in and open Links.',
      'Select Settings for the link you want to route.',
      'Under Routing rules, select Add rule, then Add condition and pick a type such as Country or Device.',
      'Under Go to, choose One URL or A/B split and enter the destination.',
      'Select Save.'
    ],
    limit: 'A link can have up to 20 rules.',
    faq: [
      {
        q: 'What happens when no rule matches?',
        a: 'The visitor goes to the link destination, the same as a link with no rules.'
      },
      {
        q: 'How does an A/B split work?',
        a: 'A rule can split visitors across 2 to 5 destinations. Each weight is a whole number from 1 to 100, and the weights must add up to 100.'
      },
      {
        q: 'Can I set rules from the homepage or the API?',
        a: 'No. Rules are set in the dashboard by the signed-in owner of a link. Links made on the homepage start without rules, and the API cannot set them.'
      }
    ],
    factIds: ['smart-routing', 'ab-split']
  },
  'password-protected-links': {
    title: 'Password-protected short links | iksi',
    label: 'Password links',
    description:
      'Put a password on any iksi short link you own. Visitors see a password page first and only continue to the destination once they enter it.',
    answer:
      'A password-protected link shows a password page before it redirects. Visitors enter the password to continue, and iksi stores it hashed, not as plain text.',
    steps: [
      'Sign in and open Links.',
      'Select Settings for the link you want to protect.',
      'Enter a Password. It needs at least 4 characters.',
      'Select Save.'
    ],
    limit: 'A password is 4 to 128 characters.',
    faq: [
      {
        q: 'How do I change or remove a password?',
        a: 'Open the link settings and select Change password or Remove password, then select Save.'
      },
      {
        q: 'Can I add a password to a one-time link?',
        a: 'Yes. When you create a one-time link, select Add a password. The visitor enters it before the link can be opened.'
      },
      {
        q: 'Can I set a password through the API?',
        a: 'No. The API cannot set a password on a regular link. Set it in the dashboard.'
      }
    ],
    factIds: ['password']
  },
  'link-expiry': {
    title: 'Expiring short links by date or clicks | iksi',
    label: 'Link expiry',
    description:
      'Make an iksi short link stop working on a date, after a number of clicks, or both. Visitors then see a page saying the link has expired.',
    answer:
      'An expiring link stops working on a date you pick, after a number of clicks, or both. Once either limit is reached, visitors see a page that says the link has expired.',
    steps: [
      'Sign in and open Links.',
      'Select Settings for the link.',
      'Set an Expiry date and time, a Click limit, or both. The date uses your time zone.',
      'Select Save.'
    ],
    limit: 'A click limit is a whole number from 1 to 1,000,000,000, and it must be higher than the clicks the link already has.',
    faq: [
      {
        q: 'Can I bring an expired link back?',
        a: 'Yes. Clear or move the expiry date, or raise the click limit, and select Save. The link works again once neither limit blocks it.'
      },
      {
        q: 'What do visitors see after it expires?',
        a: 'A page titled This link has expired, with a note to ask the sender for a new one.'
      },
      {
        q: 'Can I set an expiry through the API?',
        a: 'No. The API cannot set an expiry on a regular link. Set it in the dashboard.'
      }
    ],
    factIds: ['expiry']
  },
  'one-time-links': {
    title: 'One-time links that open once | iksi',
    label: 'One-time links',
    description:
      'Share a URL or a short text with an iksi one-time link. It opens once and is then erased. Unopened links expire after 7 days.',
    answer:
      'A one-time link holds a URL or a text and can be opened once. After the first visitor opens it, the content is erased and later visitors see a page saying the link was already opened.',
    steps: [
      'On the iksi homepage, choose One-time link, then URL or Text.',
      'Paste the URL or type the text.',
      'Optionally select Add a password.',
      'Select Create one-time link and send the link to one person.'
    ],
    limit: 'A text is up to 2,000 characters, and an unopened link expires after 7 days.',
    faq: [
      {
        q: 'Does a link preview use it up?',
        a: 'No. Opening the link shows a page with an Open link or Reveal message button. Only that button uses the link.'
      },
      {
        q: 'Do I need an account?',
        a: 'No. You can create one-time links from the homepage without signing in.'
      },
      {
        q: 'Can I choose the link name?',
        a: 'No. One-time links always get a random name.'
      }
    ],
    factIds: ['one-time-links']
  }
};

/** @returns {string[]} */
export function featureSlugs() {
  return Object.keys(FEATURE_PAGES);
}

/**
 * The plan label for a feature page, read from the facts file.
 * Null when the facts do not offer the feature.
 * @param {string} slug
 * @param {ReadonlyArray<import('./facts.js').Feature>} features
 * @returns {'Free' | 'Paid' | null}
 */
export function planLabel(slug, features = FEATURES) {
  const f = features.find((x) => x.iksi.feature === slug);
  if (!f || !f.iksi.offered) return null;
  if (f.iksi.plan === 'free') return 'Free';
  if (f.iksi.plan === 'paid') return 'Paid';
  return null;
}

/** The iksi fact for each of a page's factIds. @param {string} slug */
export function featureFacts(slug, features = FEATURES) {
  return FEATURE_PAGES[slug].factIds
    .map((id) => features.find((f) => f.id === id))
    .filter((f) => f !== undefined)
    .map((f) => ({ label: f.label, value: f.iksi.value }));
}
