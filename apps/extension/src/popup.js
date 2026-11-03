// Popup: who is connected and their profile links (each copies on click),
// and the current tab, shortened on request with a copy button.
import { ERRORS, isShortenable, shortenUrl } from './shorten.js';
import { applyPalette, readCachedProfile, refreshProfile, sameProfile } from './profile.js';

const $ = (id) => document.getElementById(id);
let tabUrl = '';
let shortUrl = '';
let copyTimer;
let shownProfile = null;
let profileUrl = '';

const COPIED_MS = 2000;
const ICON_COPY =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const ICON_CHECK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function setStatus(text, isError = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.setAttribute('role', isError ? 'alert' : 'status');
}

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function usePastedKey() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/options.html?paste=1') });
  window.close();
}

/** A key iksi will not take: say so, with the way to fix it. */
function showKeyProblem(message) {
  setStatus(message, true);
  const fix = document.createElement('button');
  fix.type = 'button';
  fix.className = 'btn btn-text';
  fix.style.marginLeft = '4px';
  fix.textContent = 'Open options';
  fix.addEventListener('click', openOptions);
  $('status').append(fix);
}

/**
 * The connect window takes focus and this popup closes, so the background
 * worker runs the flow and reports back with a notification. If the popup is
 * still open when it ends (the window failed at once), show it here too.
 */
async function connectToIksi() {
  const button = $('connect');
  button.disabled = true;
  button.innerHTML = '<span class="spinner" role="status" aria-label="Connecting"></span>';
  const status = $('connect-status');
  status.textContent = '';
  status.classList.remove('error');
  const result = await chrome.runtime.sendMessage({ target: 'background', type: 'connect', from: 'popup' }).catch(() => null);
  button.disabled = false;
  button.textContent = 'Connect to iksi';
  if (result?.ok) {
    $('no-key').hidden = true;
    await init();
    if (!$('status').textContent) setStatus('Connected');
    return;
  }
  status.textContent = result?.message ?? 'Could not connect. Try again.';
  status.classList.add('error');
  status.setAttribute('role', 'alert');
}

async function copy() {
  try {
    await navigator.clipboard.writeText(shortUrl);
    $('copy').textContent = 'Copied';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => ($('copy').textContent = 'Copy'), 1400);
    return true;
  } catch {
    setStatus('Could not copy. Select the link and copy it yourself.', true);
    return false;
  }
}

/** Copies `url` and swaps `icon` to a check for a moment. Same size, so nothing moves. */
async function copyWithIcon(url, icon) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    setStatus('Could not copy. Try again.', true);
    return;
  }
  clearTimeout(icon.copiedTimer);
  icon.innerHTML = ICON_CHECK;
  icon.classList.add('on');
  // Cleared first, so a second copy is announced too.
  const announce = $('announce');
  announce.textContent = '';
  requestAnimationFrame(() => (announce.textContent = 'Copied'));
  icon.copiedTimer = setTimeout(() => {
    icon.innerHTML = ICON_COPY;
    icon.classList.remove('on');
  }, COPIED_MS);
}

function linkRow({ title, url, path }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lrow';
  button.setAttribute('aria-label', `Copy ${title}, ${url.replace(/^https:\/\//, '')}`);
  const t = document.createElement('span');
  t.className = 'lt clip';
  t.textContent = title;
  const p = document.createElement('span');
  p.className = 'ls clip';
  p.textContent = path;
  const icon = document.createElement('span');
  icon.className = 'lc';
  icon.innerHTML = ICON_COPY;
  button.append(t, p, icon);
  button.addEventListener('click', () => copyWithIcon(url, icon));
  const li = document.createElement('li');
  li.append(button);
  return li;
}

/** Draws the identity and the profile links. Null hides them. */
function renderProfile(profile) {
  shownProfile = profile;
  applyPalette(document.documentElement, profile?.palette ?? null);
  $('identity').hidden = !profile;
  const rows = profile ? profile.links.map(linkRow) : [];
  $('links').replaceChildren(...rows);
  $('links-label').hidden = rows.length === 0;
  $('links-paper').hidden = rows.length === 0;
  if (!profile) return;

  // No handle yet: one line pointing to the dashboard, nothing else.
  const hasHandle = !!profile.handle;
  const hasAvatar = hasHandle && !!profile.avatarUrl;
  const avatar = $('avatar');
  avatar.hidden = !hasAvatar;
  if (hasAvatar) avatar.src = profile.avatarUrl;
  else avatar.removeAttribute('src');
  $('avatar-letter').hidden = !hasHandle || hasAvatar;
  $('avatar-letter').textContent = (profile.displayName ?? '').slice(0, 1).toUpperCase();

  $('name').hidden = !hasHandle;
  $('name').textContent = hasHandle ? profile.displayName : '';
  $('no-handle').hidden = hasHandle;

  profileUrl = profile.profileUrl ?? '';
  $('profile-link').hidden = !profileUrl;
  $('profile-label').textContent = profile.profileLabel ?? '';
  $('profile-link').setAttribute('aria-label', `Copy your profile link, ${profile.profileLabel ?? ''}`);
  clearTimeout($('profile-icon').copiedTimer);
  $('profile-icon').innerHTML = ICON_COPY;
  $('profile-icon').classList.remove('on');
}

/** Before the first profile ever arrives: hold the identity's place, empty. */
function renderProfilePlaceholder() {
  $('identity').hidden = false;
  $('avatar').hidden = true;
  $('avatar-letter').hidden = false;
  $('avatar-letter').textContent = '';
  $('name').hidden = false;
  $('name').textContent = '';
  $('profile-link').hidden = true;
  $('no-handle').hidden = true;
}

async function shorten() {
  const button = $('shorten');
  button.disabled = true;
  button.innerHTML = '<span class="spinner" role="status" aria-label="Shortening"></span>';
  setStatus('');

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  const result = await shortenUrl({ key: apiKey, url: tabUrl, fetch });

  if (!result.ok) {
    button.disabled = false;
    button.textContent = 'Shorten this page';
    if (result.code === 'bad_key' || result.code === 'no_key') showKeyProblem(result.message);
    else setStatus(result.message, true);
    return;
  }

  shortUrl = result.url;
  $('short').textContent = result.label;
  $('action').hidden = true;
  $('done').hidden = false;
  if (await copy()) setStatus('Copied to your clipboard.');
  $('copy').focus();
}

function wire() {
  $('options').addEventListener('click', openOptions);
  $('connect').addEventListener('click', connectToIksi);
  $('use-key').addEventListener('click', usePastedKey);
  $('shorten').addEventListener('click', shorten);
  $('copy').addEventListener('click', async () => {
    if (await copy()) setStatus('Copied to your clipboard.');
  });
  $('profile-link').addEventListener('click', () => {
    if (profileUrl) copyWithIcon(profileUrl, $('profile-icon'));
  });
  $('avatar').addEventListener('error', () => {
    $('avatar').hidden = true;
    $('avatar-letter').hidden = false;
  });
}

const reveal = () => document.documentElement.classList.remove('loading');

async function init() {
  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) {
    renderProfile(null);
    $('ready').hidden = true;
    $('no-key').hidden = false;
    reveal();
    $('connect').focus();
    return;
  }

  // The last profile seen draws at once; a fresh one replaces it quietly.
  // activeTab: opening the popup grants this tab's URL, nothing broader.
  const storage = chrome.storage.local;
  const [cached, [tab]] = await Promise.all([
    readCachedProfile({ key: apiKey, storage }),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);
  if (cached) renderProfile(cached);
  else renderProfilePlaceholder();

  tabUrl = tab?.url ?? '';
  $('ready').hidden = false;
  $('page-title').textContent = tab?.title || 'This page';
  // The address without its scheme, like the mockup; the full one on hover.
  $('page-url').textContent = tabUrl.replace(/^https?:\/\//, '');
  $('page-url').title = tabUrl;
  reveal();

  if (!isShortenable(tabUrl)) {
    $('shorten').disabled = true;
    setStatus(ERRORS.unsupported, true);
  } else {
    $('shorten').focus();
  }

  const result = await refreshProfile({ key: apiKey, storage, fetch });
  if (result.ok) {
    if (!sameProfile(shownProfile, result.profile)) renderProfile(result.profile);
  } else if (result.code === 'bad_key') {
    renderProfile(null);
    showKeyProblem(result.message);
  } else if (!shownProfile) {
    renderProfile(null);
  }
}

// Never stay invisible, whatever goes wrong while loading.
setTimeout(reveal, 400);
wire();
init().finally(reveal);
