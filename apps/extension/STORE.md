# Chrome Web Store listing

Copy for the iksi extension's store listing and privacy tab, version 1.1.0.
Keep it in step with the code: if a permission or a request changes, change
this file in the same commit.

## Short description

Max 132 characters.

> Shorten any link or page with iksi from the right-click menu or the toolbar. The short link is copied for you.

(110 characters)

## Full description

> iksi turns long links into short ones at iksi.app.
>
> Right-click any link and choose "Shorten link with iksi", or right-click a page and choose "Shorten this page with iksi". The short link is copied to your clipboard, ready to paste. You can also click the iksi button in the toolbar to shorten the page you are on and copy the result.
>
> Getting started takes one click. Choose "Connect to iksi", sign in to your iksi account if asked, and choose Allow. The extension then shortens links as you, and every link shows up in your iksi dashboard with its clicks.
>
> Prefer to set it up by hand? Create an API key in your iksi dashboard and paste it into the extension options instead.
>
> You stay in control. The extension only talks to iksi.app, and only when you ask it to shorten something. Disconnect it any time from Connected apps in your iksi dashboard, or remove the key in the extension options.
>
> You need a free iksi account at https://www.iksi.app.

## Single purpose

> The extension shortens the link or page the user chooses with the iksi link shortener (iksi.app) and copies the short link to the clipboard.

## Permission justifications

| Permission | Justification |
|---|---|
| `contextMenus` | Adds the two right-click items, "Shorten link with iksi" and "Shorten this page with iksi", which are the main way to use the extension. |
| `storage` | Saves the user's iksi API key (from Connect to iksi or pasted by hand) in chrome.storage.sync, so the user does not have to connect again. Nothing else is stored. |
| `activeTab` | When the user opens the toolbar popup, reads the current tab's URL (to shorten it) and title (shown in the popup so the user knows which page will be shortened). No other tabs are read, and nothing is read until the user opens the popup. |
| `offscreen` | A service worker cannot reach the clipboard. After a right-click shorten, the extension opens an offscreen document with the CLIPBOARD reason only to copy the short link. |
| `clipboardWrite` | Copies the short link to the clipboard after a right-click shorten, which is the extension's purpose. |
| `notifications` | Tells the user when a right-click shorten could not be done or copied, and whether Connect to iksi worked, since the popup has closed by then. |
| `identity` | Runs Connect to iksi with chrome.identity.launchWebAuthFlow: it opens iksi.app/connect/extension in a window and receives the user's new iksi API key from the redirect to this extension's chromiumapp.org address. The extension does not use getAuthToken and never accesses the user's Google account. |
| Host `https://www.iksi.app/*` | The extension sends shorten requests to the iksi API at https://www.iksi.app/api/shorten. It makes no requests to any other site. |

Remote code: none. All code ships in the package.

## Data usage disclosure

What the extension sends, and where:

- To `https://www.iksi.app/api/shorten`, only when the user shortens something: the URL being shortened, and the user's iksi API key (as the Authorization header). Cookies are not sent with it.
- To `https://www.iksi.app/connect/extension`, only when the user chooses Connect to iksi: a random one-time value (the state) and the extension's redirect address. The page then runs in a browser window under the user's own iksi sign-in.

Nothing else is collected or sent. The extension does not read page content, browsing history or other tabs, and has no analytics. The page title shown in the popup stays on the device. The API key is kept in chrome.storage.sync (which Chrome syncs to the user's other browsers when Chrome sync is on) and is shown again only as its first characters.

What iksi does with it on the server (see https://www.iksi.app/privacy):

- The URL becomes the destination of a short link owned by the user's account. It is stored encrypted (AES-256-GCM), and it is sent to Google Safe Browsing to be checked for malware and phishing, like every iksi link.
- The key is checked against its stored SHA-256 hash, and the key's last-used time is recorded (to the minute).
- Like any web request, the shorten request reveals the user's IP address. iksi counts shorten requests per visitor for rate limiting, in a database counter that holds a keyed hash (HMAC-SHA256) of the IP address, never the address itself; a daily job deletes the counter within about two days. No IP address is stored with the link or its clicks.

Privacy tab answers:

- Data collected: Authentication information (the iksi API key), and Web history only in the narrow sense that the URL the user chooses to shorten is sent to iksi to make the short link.
- Location: the store counts IP address as location data. The extension does not read it, but iksi's server uses the request's IP address for rate limiting (storing only a keyed hash of it, see above), so declare Location too rather than risk an inaccurate disclosure.
- Not collected: personally identifiable information, health, financial, personal communications, user activity, website content.
- Certifications: the data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used or transferred to determine creditworthiness or for lending.
- Privacy policy: https://www.iksi.app/privacy (its "API keys and the browser extension" section covers the extension). Required for an extension that handles authentication information.

## Screenshots to capture

1280×800 PNG, dark theme, no personal data on screen.

1. A web page with the right-click menu open on a link, showing "Shorten link with iksi".
2. The toolbar popup over a page after shortening: the short link in its field with Copy, and "Copied to your clipboard."
3. The popup before connecting: "Connect iksi to start" with the Connect to iksi button.
4. The connect window: "Connect the iksi extension?" with Allow and Cancel.
5. The options page after connecting: Account, Connected, with the key prefix.
6. The iksi dashboard Connected apps section showing Chrome extension with its Connected and Last used lines.

Small promo tile (440×280): the iksi brand mark and "Shorten any link from the right-click menu" on the dark canvas.
