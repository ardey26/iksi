// Popup: shortens the current tab on request and shows the link with a copy button.
import { ERRORS, isShortenable, shortenUrl } from './shorten.js';

const $ = (id) => document.getElementById(id);
let tabUrl = '';
let shortUrl = '';
let copyTimer;

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
    setStatus(result.message, true);
    if (result.code === 'bad_key' || result.code === 'no_key') {
      const fix = document.createElement('button');
      fix.type = 'button';
      fix.className = 'btn btn-text';
      fix.style.marginLeft = '4px';
      fix.textContent = 'Open options';
      fix.addEventListener('click', openOptions);
      $('status').append(fix);
    }
    return;
  }

  shortUrl = result.url;
  $('short').textContent = result.label;
  $('action').hidden = true;
  $('done').hidden = false;
  if (await copy()) setStatus('Copied to your clipboard.');
  $('copy').focus();
}

async function init() {
  $('options').addEventListener('click', openOptions);
  $('add-key').addEventListener('click', openOptions);
  $('shorten').addEventListener('click', shorten);
  $('copy').addEventListener('click', async () => {
    if (await copy()) setStatus('Copied to your clipboard.');
  });

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) {
    $('no-key').hidden = false;
    $('add-key').focus();
    return;
  }

  // activeTab: opening the popup grants this tab's URL, nothing broader.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = tab?.url ?? '';
  $('ready').hidden = false;
  $('page-title').textContent = tab?.title || 'This page';
  $('page-url').textContent = tabUrl;

  if (!isShortenable(tabUrl)) {
    $('shorten').disabled = true;
    setStatus(ERRORS.unsupported, true);
    return;
  }
  $('shorten').focus();
}

init();
