<script>
  // The privacy policy. It describes what the code does today; when a data
  // flow changes (a new field, a new service, a new cookie), change this page
  // and UPDATED in the same commit. Title, description, canonical and robots
  // come from the layout's seoForRoute.
  import { Container, PageHeader, Paper, Section } from '#lib/ui/index.js';

  const UPDATED = 'November 1, 2026';
  const CONTACT = 'andre@iksi.app';

  const SECTIONS = [
    { id: 'summary', title: 'The short version' },
    { id: 'accounts', title: 'Accounts and sign-in' },
    { id: 'links', title: 'Links' },
    { id: 'clicks', title: 'Clicks and visits' },
    { id: 'profiles', title: 'Profiles' },
    { id: 'payments', title: 'Payment methods' },
    { id: 'reports', title: 'Reports' },
    { id: 'extension', title: 'API keys and the browser extension' },
    { id: 'ip-addresses', title: 'IP addresses' },
    { id: 'cookies', title: 'Cookies and local storage' },
    { id: 'services', title: 'Services that handle data' },
    { id: 'retention', title: 'How long data is kept' },
    { id: 'deletion', title: 'Deleting your data' },
    { id: 'rights', title: 'Your rights' },
    { id: 'children', title: 'Children' },
    { id: 'changes', title: 'Changes to this policy' },
    { id: 'contact', title: 'Contact' }
  ];

  const title = (id) => SECTIONS.find((s) => s.id === id).title;
</script>

<Container class="policy">
  <PageHeader title="Privacy" description="Last updated {UPDATED}" />

  <p class="lead">
    This page explains what iksi collects when you use it, why, who else handles it, how long it is kept, and how to
    get it deleted. iksi is a small service run by one person, Andre de Jesus, in the Philippines. Questions go to
    <a href="mailto:{CONTACT}">{CONTACT}</a>.
  </p>

  <Paper as="nav" padding="sm" class="toc" aria-label="Contents">
    <p class="toc-title t-label">Contents</p>
    <ol>
      {#each SECTIONS as s (s.id)}
        <li><a href="#{s.id}">{s.title}</a></li>
      {/each}
    </ol>
  </Paper>

  <div class="sections">
    <Section id="summary" title={title('summary')}>
      <ul>
        <li>You can shorten links without an account. If you sign in, iksi keeps a few details from Google or X, your links and your profile.</li>
        <li>The address a short link points to is stored encrypted. Clicks are counted by country, device, browser and the site they came from. IP addresses are never stored as they are: clicks have none, and rate limits and reports keep only a keyed hash.</li>
        <li>Your profile page is public, and so is everything you put on it, including payment QR codes.</li>
        <li>iksi does not sell personal data, shows no ads and sets no advertising or analytics cookies.</li>
        <li>Email <a href="mailto:{CONTACT}">{CONTACT}</a> to get a copy of your data, fix it or delete it.</li>
      </ul>
    </Section>

    <Section id="accounts" title={title('accounts')}>
      <p>You sign in with Google or with X. iksi never sees your password for either.</p>
      <ul>
        <li><strong>Google:</strong> iksi stores your Google account ID and your email address, and refreshes the email each time you sign in.</li>
        <li><strong>X:</strong> iksi stores your X account ID and your X username, and refreshes the username each time you sign in.</li>
        <li>On your first sign-in, your name and the link to your profile picture are copied into your iksi profile. After that they are yours to change, and iksi does not refresh them.</li>
      </ul>
      <p>
        iksi uses the access Google or X gives it once, to read those details, and does not keep it. From Google it asks
        for your basic profile and email address. From X it asks only to read your account (users.read, plus tweet.read,
        which X requires for that) and not for offline access, so X never gives it a refresh token. iksi does not read
        your posts or email, and never posts for you.
      </p>
      <p>
        iksi also stores when your account was made, the handle you claim (iksi.app/@you) and when you claimed it, and
        your settings, such as whether custom names go under your handle.
      </p>
    </Section>

    <Section id="links" title={title('links')}>
      <p>When you shorten a link, with or without an account, iksi stores:</p>
      <ul>
        <li><strong>The destination</strong>, encrypted with AES-256-GCM. The key is held on iksi's server, because iksi has to decrypt the address to send visitors there. Encryption protects stored copies of the database; it does not hide the address from iksi itself.</li>
        <li><strong>A fingerprint of the destination</strong> (a SHA-256 hash), for links made without an account and without a custom name, so shortening the same address again returns the same short link.</li>
        <li><strong>The short name</strong>, random or one you chose. Anyone with a short link can follow it to its destination.</li>
        <li><strong>When it was made</strong>, how many times it was opened, and its safety status: the Google Safe Browsing result and when it was checked, and whether it is held or disabled after reports.</li>
      </ul>
      <p>If you are signed in, iksi also stores which account owns the link and any settings you add:</p>
      <ul>
        <li>Routing rules: the conditions (countries, devices, referring sites, times) and the other destinations they send visitors to. These are stored as plain text, not encrypted.</li>
        <li>A password, stored only as a bcrypt hash.</li>
        <li>An expiry date or a click limit, and whether the redirect is permanent.</li>
      </ul>
      <p>
        A link stops working when it expires, but it stays stored until it is deleted. Links made without an account have
        no owner, so you cannot delete them yourself; email the short link to <a href="mailto:{CONTACT}">{CONTACT}</a> and
        it will be removed.
      </p>
      <p>
        <strong>One-time links.</strong> The content (a web address, or a text of up to 2,000 characters) is encrypted the
        same way, and an optional password is stored as a bcrypt hash. When someone opens the link, the content is erased
        in the same step. If nobody opens it within 7 days, it expires, and a daily job erases the content within about a
        day. The record that the link existed (its name, dates and owner) stays.
      </p>
      <p>
        <strong>Safety checks.</strong> Every destination, including routing rule destinations and one-time web
        addresses, is sent to Google Safe Browsing to check for malware and phishing when a link is made or changed. Links
        on public profiles are checked again each day.
      </p>
    </Section>

    <Section id="clicks" title={title('clicks')}>
      <p>When someone opens a short link, iksi records:</p>
      <ul>
        <li>the time,</li>
        <li>the country, as a two-letter code (iksi's host works it out from the IP address; iksi receives only the code),</li>
        <li>the type of device and the browser, worked out from the browser's user agent (the user agent itself is not stored),</li>
        <li>the host name of the site the visitor came from, like instagram.com, when the browser sends it,</li>
        <li>whether the click came from an iksi profile page, and which one.</li>
      </ul>
      <p>When someone opens a profile page, iksi records the time, the country and the referring site's host name.</p>
      <p>
        No IP address, cookie or visitor ID is stored with clicks or visits, and iksi does not link them to a person. Routing rules look at the visitor's country, device, operating system, referring site and the time, but only
        to choose where that one request goes.
      </p>
      <p>Link owners see their own click counts in the dashboard. A profile owner can choose to show click counts on their public page.</p>
    </Section>

    <Section id="profiles" title={title('profiles')}>
      <p>
        Claiming a handle gives you a public page at www.iksi.app/@handle, and at handle.iksi.app where that is turned on.
        Everything on it is public: your display name, bio, avatar, background image, colors, the links you add (their
        titles and short links), click counts if you turn them on, and your payment methods.
      </p>
      <p>
        The same details are available as public data at /api/@handle and in the page's share image. Profiles with a bio
        or at least one link are listed in iksi's sitemap so search engines can find them. If a link on your page goes to
        a well-known social profile (like Instagram or GitHub), that address is included in the page's data for search
        engines.
      </p>
      <p>
        <strong>Uploaded images.</strong> Avatars and backgrounds you upload are converted to WebP at fixed sizes and
        stored in Cloudflare R2, then served from www.iksi.app/media. The original file and its metadata, such as camera
        or location details, are not kept. Replacing or removing an image deletes the old files.
      </p>
      <p>
        <strong>Image links.</strong> If your avatar is a link to an image elsewhere (such as your Google or X picture, or
        an address you pasted), visitors' browsers load it from that site, which can see their IP address.
      </p>
    </Section>

    <Section id="payments" title={title('payments')}>
      <p>You can add up to 3 payment methods behind a Pay button on your profile. iksi does not process payments; payers pay in their own bank or wallet app.</p>
      <ul>
        <li><strong>Payment QR codes</strong> (like QR Ph). You upload a picture of your code. iksi reads the code and stores only the text inside it. The picture is not stored.</li>
        <li>That text includes the account name and city, and a personal QR Ph code often includes your mobile number. Anyone who opens Pay on your page sees the account name and bank and gets the full QR code, which they can scan or read. Only add a code you are comfortable making public.</li>
        <li><strong>Payment links</strong> (like PayPal or Wise). iksi stores the link and shows it to anyone who opens Pay.</li>
      </ul>
    </Section>

    <Section id="reports" title={title('reports')}>
      <p>
        Anyone can report a short link at <a href="/report">/report</a>, without an account. The form asks for the short
        link, a reason, optional details (up to 1,000 characters) and an optional email address, used only to reply to
        you.
      </p>
      <p>
        iksi stores those with the time and a keyed hash of your IP address (see <a href="#ip-addresses">IP addresses</a>),
        not the address itself. Only iksi's operator sees reports; the link's owner is not told who reported it. Reports
        are kept until the reported link is deleted. There is no automatic deletion yet.
      </p>
    </Section>

    <Section id="extension" title={title('extension')}>
      <p>
        API keys let the iksi browser extension, or your own scripts, shorten links as you. iksi stores a SHA-256 hash of
        each key, never the key itself, along with its name, its first characters (like iksi_ab12), whether the extension
        made it, when it was made, when it was last used (to the minute) and when it was revoked. A revoked key stops
        working, and its record stays.
      </p>
      <p>
        The extension sends iksi only the address you choose to shorten and your API key, and only when you shorten
        something. It does not send cookies, page content, your browsing history or other tabs, and it has no analytics.
        The page title shown in its popup stays on your device. The key is kept in Chrome's synced storage, which Chrome
        copies to your other browsers when Chrome sync is on. A link shortened with the extension is stored and checked
        like any other link.
      </p>
    </Section>

    <Section id="ip-addresses" title={title('ip-addresses')}>
      <p>Every request to iksi carries your IP address. This is what iksi does with it:</p>
      <ul>
        <li><strong>Country.</strong> iksi's host works out your country from it. Only the country code is stored, with clicks and profile visits.</li>
        <li><strong>Rate limits.</strong> To stop abuse, iksi counts requests per visitor for some actions: shortening a link, password and one-time link attempts (counted per link), claiming a handle, opening a Pay sheet, the public profile data and sending a report. Each counter is a database record holding the action (for password attempts, the link's name), a keyed hash (HMAC-SHA256) of the IP address, a count and when the count resets. The address itself is never stored. Counter windows last an hour at most, and a daily job deletes each counter once its window has been over for a day, so none is kept more than about two days after its window ends. Counters made before this change held the address itself; they have been deleted, and copies in backups age out within 30 days.</li>
        <li><strong>Reports.</strong> iksi stores a keyed hash (HMAC-SHA256) of the reporter's IP address instead of the address, so it can tell whether several reports came from different people.</li>
        <li><strong>Hosting.</strong> Vercel, iksi's host, sees IP addresses as part of serving every request and handles them under its own privacy policy.</li>
      </ul>
    </Section>

    <Section id="cookies" title={title('cookies')}>
      <p>iksi sets these cookies itself:</p>
      <ul>
        <li><strong>user_session</strong>: keeps you signed in. Set when you sign in, lasts 30 days, removed when you sign out. It is HttpOnly, so page scripts cannot read it, and it holds your iksi user ID, an expiry time and a signature.</li>
        <li><strong>oauth_state</strong> and <strong>oauth_pkce</strong>: protect the sign-in round trip with Google or X. They last 10 minutes and are removed when you come back.</li>
        <li><strong>login_next</strong>: remembers which iksi page to return you to after signing in, for example when connecting the browser extension. HttpOnly, lasts 10 minutes, removed when you come back.</li>
      </ul>
      <p>
        iksi also saves your light or dark theme choice in your browser's local storage, under the name theme. It never
        leaves your device.
      </p>
      <p>iksi shows no ads and sets no advertising or analytics cookies.</p>
    </Section>

    <Section id="services" title={title('services')}>
      <p>iksi relies on these services to run. Each handles data only as needed for its part:</p>
      <ul>
        <li><strong>Vercel</strong> hosts the site. The app runs in Singapore, and Vercel sees every request.</li>
        <li><strong>Supabase</strong> hosts the database, in Singapore. It holds the account, link, click, profile and report data described on this page.</li>
        <li><strong>Cloudflare</strong> stores uploaded images (R2) and nightly copies of the database, which are kept for 30 days. It also still holds copies of some link records (short name, destination and settings) from when short links were served through Cloudflare's network. That layer is switched off now, and visitor traffic does not go through Cloudflare.</li>
        <li><strong>GitHub</strong> runs the nightly backup job. The database copy passes through a temporary GitHub machine on its way to Cloudflare.</li>
        <li><strong>Google Safe Browsing</strong> receives link destinations to check them for malware and phishing.</li>
        <li><strong>Google and X</strong> handle sign-in.</li>
      </ul>
      <p>
        iksi does not use an analytics or advertising service, and its fonts are served from iksi itself. iksi's operator can see stored
        data to run the service, handle reports and answer requests.
      </p>
      <p>Your data is stored outside the Philippines, mainly in Singapore. Google, X and the other services may process it in other countries.</p>
    </Section>

    <Section id="retention" title={title('retention')}>
      <ul>
        <li><strong>Account, handle and profile:</strong> until you ask for them to be deleted.</li>
        <li><strong>Links and their settings:</strong> until they are deleted, by you, on request or by moderation. Expired links stay stored.</li>
        <li><strong>Clicks:</strong> as long as the link exists. They are deleted with it.</li>
        <li><strong>Profile visits:</strong> as long as the profile exists.</li>
        <li><strong>One-time link content:</strong> erased when the link is opened, or about a day after it expires unopened.</li>
        <li><strong>Reports:</strong> until the reported link is deleted.</li>
        <li><strong>API keys:</strong> until your account is deleted, revoked ones included.</li>
        <li><strong>Rate-limit counters:</strong> deleted by a daily job once their window has been over for a day, so within about two days.</li>
        <li><strong>Backups:</strong> 30 days. Deleted data can stay in a backup until it ages out.</li>
        <li><strong>Cookies:</strong> 30 days for the session, 10 minutes for the sign-in cookies.</li>
      </ul>
    </Section>

    <Section id="deletion" title={title('deletion')}>
      <ul>
        <li><strong>Delete a link</strong> in your dashboard: the link, its settings, its clicks, any reports about it and its row on your profile are deleted.</li>
        <li><strong>Remove a link from your profile</strong>: only the row on your page goes. The link and its clicks stay until you delete the link.</li>
        <li><strong>Remove an image or a payment method</strong>: it is deleted from your profile, and an uploaded image's files are deleted from storage.</li>
        <li><strong>Revoke an API key</strong> in your dashboard: it stops working at once.</li>
        <li><strong>Sign out</strong>: the session cookie is removed.</li>
      </ul>
      <p>
        There is no delete-account button yet. To delete your account, email <a href="mailto:{CONTACT}">{CONTACT}</a> with
        your handle or the email you sign in with. You may be asked to confirm from your account. Your account, handle,
        profile, uploaded images, API keys and links (with their clicks) will be deleted. Copies in backups age out within
        30 days.
      </p>
    </Section>

    <Section id="rights" title={title('rights')}>
      <p>You can ask iksi to:</p>
      <ul>
        <li>tell you what data it holds about you, and give you a copy,</li>
        <li>correct it (most of it you can edit in your dashboard),</li>
        <li>delete it,</li>
        <li>stop using it for a purpose you object to.</li>
      </ul>
      <p>
        Email <a href="mailto:{CONTACT}">{CONTACT}</a>. iksi does not sell personal data. Apart from what you make public
        on your profile, it shares data only with the services listed above.
      </p>
      <p>
        iksi is run from the Philippines, so the Data Privacy Act of 2012 (Republic Act No. 10173) applies. It gives you
        rights that include being informed, access, correction, objection, erasure or blocking, and data portability, and
        you can file a complaint with the National Privacy Commission
        (<a href="https://privacy.gov.ph/" rel="noopener">privacy.gov.ph</a>) if you think your data was mishandled.
      </p>
    </Section>

    <Section id="children" title={title('children')}>
      <p>
        iksi is not meant for children under 13, and does not knowingly collect their data. If you think a child has given
        iksi personal data, email <a href="mailto:{CONTACT}">{CONTACT}</a> and it will be deleted.
      </p>
    </Section>

    <Section id="changes" title={title('changes')}>
      <p>
        When this policy changes, this page is updated along with the date at the top. The version on this page is the
        one that applies.
      </p>
    </Section>

    <Section id="contact" title={title('contact')}>
      <p>
        Andre de Jesus runs iksi. For anything about your data or this policy, email
        <a href="mailto:{CONTACT}">{CONTACT}</a>.
      </p>
    </Section>
  </div>
</Container>

<style>
  /* A readable column: the form width, narrowed to about 680 for prose. */
  :global(.page-column.form.policy) {
    max-width: calc(680px + var(--gutter) * 2);
    padding-top: clamp(24px, 8vh, 80px);
    padding-bottom: 96px;
  }
  :global(.page-column.policy > .page-header) { margin-bottom: 24px; }
  .lead {
    margin: 0 0 32px;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-primary);
  }
  .toc-title {
    margin: 0 0 8px;
    color: var(--text-muted);
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 2 220px;
    column-gap: 24px;
  }
  ol li { break-inside: avoid; }
  /* 44px rows to tap on phones; 32px from 640. */
  ol a {
    display: flex;
    align-items: center;
    min-height: 44px;
    font-size: 14px;
    line-height: 20px;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: 4px;
    transition: color var(--duration-normal) var(--ease-out);
  }
  ol a:hover { color: var(--text-primary); }
  @media (min-width: 640px) {
    ol a { min-height: 32px; }
  }
  .sections { margin-top: 48px; }
  .sections :global(.ui-section) { scroll-margin-top: 24px; }
  .sections p,
  .sections ul {
    margin: 0;
    font-size: 15px;
    line-height: 22px;
    color: var(--text-muted);
  }
  .sections p + p,
  .sections p + ul,
  .sections ul + p,
  .sections ul + ul { margin-top: 12px; }
  .sections ul {
    padding-left: 20px;
    list-style: disc;
  }
  .sections li + li { margin-top: 8px; }
  .sections li::marker { color: var(--text-faint); }
  strong {
    font-weight: 500;
    color: var(--text-primary);
  }
  .lead a,
  .sections a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
    overflow-wrap: anywhere;
    border-radius: 4px;
  }
  a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    ol a { transition: none; }
  }
</style>
