// Options: connect to iksi (the usual way), or paste, replace or remove an
// API key by hand. After saving, only the key's prefix is ever shown again.
import { ERRORS, keyPrefix } from './shorten.js';
import { savePastedKey } from './connect.js';

const $ = (id) => document.getElementById(id);

const REASONS = {
  no_key: ERRORS.no_key,
  bad_key: 'iksi did not accept the saved key. It may have been disconnected. Connect again below.'
};

function setStatus(id, text, isError = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.setAttribute('role', isError ? 'alert' : 'status');
}

function showSaved(key) {
  $('saved-row').hidden = !key;
  $('connect-row').hidden = !!key;
  $('saved-prefix').textContent = key ? keyPrefix(key) : '';
  $('key-label').textContent = key ? 'Replace key' : 'API key';
}

function setPasteOpen(open) {
  const panel = $('paste');
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  panel.inert = !open;
  $('use-key').setAttribute('aria-expanded', String(open));
}

async function connectToIksi() {
  const button = $('connect');
  button.disabled = true;
  button.innerHTML = '<span class="spinner" role="status" aria-label="Connecting"></span>';
  setStatus('connect-status', '');
  const result = await chrome.runtime.sendMessage({ target: 'background', type: 'connect', from: 'options' }).catch(() => null);
  button.disabled = false;
  button.textContent = 'Connect to iksi';
  if (!result?.ok) {
    setStatus('connect-status', result?.message ?? 'Could not connect. Try again.', true);
    return;
  }
  $('reason').textContent = '';
  showSaved(result.key);
  setStatus('saved-status', 'Connected. Right-click any link or page to shorten it.');
  $('remove').focus();
}

async function init() {
  const params = new URLSearchParams(location.search);
  $('reason').textContent = REASONS[params.get('reason')] ?? '';

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  showSaved(apiKey);
  setPasteOpen(params.get('paste') === '1');

  // A connect started from the popup finishes here too.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && 'apiKey' in changes) showSaved(changes.apiKey.newValue);
  });

  $('connect').addEventListener('click', connectToIksi);
  $('use-key').addEventListener('click', () => {
    const open = $('use-key').getAttribute('aria-expanded') !== 'true';
    setPasteOpen(open);
    if (open) $('key').focus();
  });

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = await savePastedKey($('key').value, chrome.storage.sync);
    if (!result.ok) {
      setStatus('status', result.message, true);
      return;
    }
    $('key').value = '';
    $('reason').textContent = '';
    showSaved(result.key);
    setStatus('status', 'Key saved. Right-click any link or page to shorten it.');
  });

  $('remove').addEventListener('click', async () => {
    await chrome.storage.sync.remove('apiKey');
    showSaved(null);
    setStatus('saved-status', '');
    setStatus('connect-status', 'Key removed from this browser.');
    $('connect').focus();
  });

  if (params.get('paste') === '1') $('key').focus();
  else if (!apiKey) $('connect').focus();
}

init();
