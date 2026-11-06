// Copy for the /alternatives pages. It states no competitor fact: every
// number, limit and plan comes from facts.js and is rendered by the table.
// The only facts used here are iksi's own plan flags, so a "Free" claim in a
// title or answer follows the facts file.
import { FEATURES, PRODUCTS, GAPS, competitorIds } from './facts.js';

export const POSITIONING =
  'The link-in-bio where every link is a smart link. One tool instead of Linktree plus Bitly.';

/** @param {string} id */
function iksiIsFree(id) {
  const f = FEATURES.find((x) => x.id === id);
  return Boolean(f && f.iksi.offered && f.iksi.plan === 'free');
}

/** @param {import('./facts.js').CompetitorId} id */
export function alternativeCopy(id) {
  const name = PRODUCTS[id]?.name ?? id;
  const isBio = id === 'linktree';
  const free = iksiIsFree(isBio ? 'link-in-bio' : 'shortening');
  const freeWord = free ? 'Free ' : '';

  if (isBio) {
    const switchSteps = [
      'Create an iksi account and claim your handle.',
      `Add each of your ${name} links as a row on your profile.`,
      'Add routing rules, a password or an expiry to the rows that need them.',
      `Replace your ${name} URL with your iksi profile URL wherever you share it.`
    ];
    return {
      title: `${freeWord}${name} alternative with smart links | iksi`,
      description: `iksi is a link-in-bio where every row is a short link with routing, passwords and expiry. See how it compares with ${name}, row by row.`,
      answer: `${POSITIONING} The table compares iksi with ${name} row by row, and each ${name} value links to the page it came from.`,
      switchSteps,
      faq: [
        {
          q: `Is iksi a ${free ? 'free ' : ''}${name} alternative?`,
          a: free
            ? `Yes. Link-in-bio profiles are on iksi's free plan. The table shows the plan for every feature.`
            : `Link-in-bio profiles on iksi are on a paid plan. The table shows the plan for every feature.`
        },
        {
          q: `How is iksi different from ${name}?`,
          a: `Every row on an iksi profile is a short link, so you can route it with rules, protect it or expire it. One tool covers the profile and the shortener.`
        },
        {
          q: `Where does iksi fall short of ${name}?`,
          a: GAPS.join(' ')
        },
        {
          q: `How do I move from ${name} to iksi?`,
          a: switchSteps.join(' ')
        }
      ]
    };
  }

  const switchSteps = [
    'Shorten each destination URL on the iksi home page.',
    'Set a custom alias on the links you want to keep readable.',
    'Create an account to keep your links and see click totals.',
    `Replace your ${name} links wherever you control the text.`
  ];
  return {
    title: `${freeWord}${name} alternative for short links | iksi`,
    description: `iksi shortens links and turns them into a link-in-bio page with smart routing. See how it compares with ${name}, row by row.`,
    answer: `${POSITIONING} The table compares iksi with ${name} row by row, and each ${name} value links to the page it came from.`,
    switchSteps,
    faq: [
      {
        q: `Is iksi a ${free ? 'free ' : ''}${name} alternative?`,
        a: free
          ? `Yes. Shortening is free on iksi. The table shows the plan for every feature.`
          : `Shortening on iksi is on a paid plan. The table shows the plan for every feature.`
      },
      {
        q: `How is iksi different from ${name}?`,
        a: `iksi puts a link-in-bio profile and the shortener in one tool, and every link can route visitors with rules.`
      },
      {
        q: `Where does iksi fall short of ${name}?`,
        a: GAPS.join(' ')
      },
      {
        q: `How do I move from ${name} to iksi?`,
        a: switchSteps.join(' ')
      }
    ]
  };
}

/** Hub copy, listing whichever competitors the facts file holds. */
export function hubCopy() {
  const names = competitorIds().map((id) => PRODUCTS[id].name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return {
    title: 'Compare iksi with other link tools | iksi',
    description: `See how iksi compares with ${list}, feature by feature. Every competitor value links to the page it came from.`,
    answer: POSITIONING
  };
}
