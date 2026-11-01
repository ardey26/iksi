// Service worker: the right-click menu items, shortening, copying, feedback,
// and the "Connect to iksi" flow.
import { MENU, shortenUrl, targetOf } from './shorten.js';
import { connect } from './connect.js';

const OFFSCREEN_PATH = 'src/offscreen.html';
const BADGE_MS = 2500;
const COLORS = { ok: '#2563EB', error: '#DC2626' };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(MENU.link);
    chrome.contextMenus.create(MENU.page);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = targetOf(info, tab);
  if (url !== null) void shortenAndCopy(url);
});

chrome.notifications?.onClicked.addListener((id) => {
  if (id.startsWith('iksi-key')) openOptions('bad_key');
  chrome.notifications.clear(id);
});

// The popup and the options page ask for a connect here. The auth window
// takes focus, which closes the popup, so the flow cannot live there.
let connecting = null;
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'background' || message.type !== 'connect') return false;
  connecting ??= connect({ identity: chrome.identity, storage: chrome.storage.sync }).finally(() => (connecting = null));
  connecting.then((result) => {
    // The popup is gone by now; say how it went where the user will see it.
    if (message.from === 'popup') announce(result);
    sendResponse(result);
  });
  return true;
});

function announce(result) {
  if (result.ok) {
    void badge('OK', COLORS.ok);
    return notify('iksi-connected', 'Connected', 'Right-click any link or page to shorten it with iksi.');
  }
  if (result.code !== 'cancelled') notify('iksi-connect-error', 'Could not connect', result.message);
}

async function shortenAndCopy(url) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const result = await shortenUrl({ key: apiKey, url, fetch });

  if (!result.ok) {
    await badge('!', COLORS.error);
    // A key problem is fixed in the options page, so go straight there.
    if (result.code === 'no_key' || result.code === 'bad_key') return openOptions(result.code);
    return notify('iksi-error', 'Could not shorten', result.message);
  }

  if (await copyText(result.url)) return badge('OK', COLORS.ok);
  await badge('!', COLORS.error);
  notify('iksi-copy', 'Short link ready', `${result.label} could not be copied. Open the iksi popup to copy it.`);
}

async function badge(text, color) {
  await chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeTextColor?.({ color: '#FFFFFF' });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), BADGE_MS);
}

function notify(id, title, message) {
  if (!chrome.notifications) return;
  chrome.notifications.create(`${id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message
  });
}

function openOptions(reason) {
  return chrome.tabs.create({ url: chrome.runtime.getURL(`src/options.html?reason=${reason}`) });
}

/**
 * A service worker has no DOM and no clipboard. Chrome copies through an
 * offscreen document; Firefox runs this file as an event page, which has one.
 */
async function copyText(text) {
  if (!chrome.offscreen) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'copy', text });
    return res?.ok === true;
  } catch {
    return false;
  }
}

let creating = null;
async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const open = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (open.length > 0) return;
  creating ??= chrome.offscreen
    .createDocument({ url: OFFSCREEN_PATH, reasons: ['CLIPBOARD'], justification: 'Copy the short link to the clipboard.' })
    .finally(() => (creating = null));
  await creating;
}
