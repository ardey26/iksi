// Copy for /tools/link-checker and /tools/url-expander. Both run on the
// server, so every claim here must match routes/api/tools and lib/server/expand.ts.

export const LINK_CHECKER = {
  title: 'Link checker: is this link safe? | iksi',
  label: 'Link checker',
  description:
    'Check a link against Google Safe Browsing with iksi before you open it. Free, no account. Flags known phishing, malware and unwanted software.',
  answer:
    'Paste a link to look it up in Google Safe Browsing. iksi never opens the page; it only asks whether the address is on Google’s lists of phishing, malware and unwanted software.',
  faq: [
    {
      q: 'Does "Safe" mean the link is safe?',
      a: 'It means Google Safe Browsing has no match for the link right now. New phishing pages appear every day and some are not listed yet, so treat it as one check, not a guarantee.'
    },
    {
      q: 'What does it check for?',
      a: 'Phishing pages that pose as a real site to take your details, malware, and unwanted or potentially harmful software, as listed by Google Safe Browsing.'
    },
    {
      q: 'Does it open the link?',
      a: 'No. It looks up the address only, so the page is never loaded. To see where a short link leads first, use the URL expander.'
    },
    {
      q: 'Why does it say it couldn’t check?',
      a: 'The lookup failed, or the free checks for today have run out. Try again later.'
    },
    {
      q: 'Is my link stored?',
      a: 'No. The link is sent to Google Safe Browsing for the lookup, and iksi does not save it.'
    },
    {
      q: 'Is it free?',
      a: 'Yes. No account is needed. Each visitor can run 20 checks an hour.'
    }
  ]
};

export const URL_EXPANDER = {
  title: 'URL expander: see where a short link goes | iksi',
  label: 'URL expander',
  description:
    'Expand a short link with iksi to see every redirect and the final destination, checked against Google Safe Browsing, before you click.',
  answer:
    'Paste a short link to see each redirect it goes through and where it ends up. iksi follows the redirects from its server, then checks the final address in Google Safe Browsing.',
  faq: [
    {
      q: 'Does it open the page?',
      a: 'No. It asks each address for its response headers only and follows the redirect they name. The page is never loaded, so no scripts run and nothing is downloaded.'
    },
    {
      q: 'Can the final destination be wrong?',
      a: 'Yes. Only HTTP redirects are followed. A page that redirects with a meta refresh tag or with JavaScript is shown as the end of the chain, and some sites send different visitors to different places.'
    },
    {
      q: 'How many redirects does it follow?',
      a: 'Up to 10 hops, counting the link you paste. Each hop has 5 seconds to answer, and the whole chain 10 seconds. A longer or slower chain stops with a note.'
    },
    {
      q: 'Why was a hop blocked?',
      a: 'It never follows a link to a private, local or internal network address, a link with a username or password in it, or a port other than the standard web ports.'
    },
    {
      q: 'Is my link stored?',
      a: 'No. iksi does not save the link or the hops. The final address is sent to Google Safe Browsing for the check.'
    },
    {
      q: 'Is it free?',
      a: 'Yes. No account is needed. Each visitor can expand 20 links an hour.'
    }
  ]
};

/** How a Safe Browsing verdict shows on the tools: a Badge and one short line. */
export const VERDICT_BADGES = {
  safe: { label: 'Safe', variant: 'success', note: 'No match in Google Safe Browsing. That is not a guarantee.' },
  phishing: { label: 'Phishing', variant: 'error', note: 'Listed by Google Safe Browsing as phishing. Do not sign in there.' },
  malware: { label: 'Malware', variant: 'error', note: 'Listed by Google Safe Browsing as malware. Do not open it.' },
  unwanted: { label: 'Unwanted', variant: 'warning', note: 'Listed by Google Safe Browsing as unwanted software.' },
  unavailable: {
    label: 'Couldn’t check right now',
    variant: 'neutral',
    note: 'The lookup failed or today’s free checks ran out. Try again later.'
  }
};

/** The host of a pasted link (a bare host gets https://), or '' when it is not one. */
export function linkHost(input) {
  const trimmed = String(input ?? '').trim();
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const parts = u.hostname.split('.');
    return ['http:', 'https:'].includes(u.protocol) && parts.length >= 2 && parts.every((x) => x.length > 0) ? u.hostname : '';
  } catch {
    return '';
  }
}
