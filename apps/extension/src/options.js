// Options: paste, replace or remove the API key. After saving, only the
// key's prefix is ever shown again.
import { ERRORS, isKeyFormat, keyPrefix } from './shorten.js';

const $ = (id) => document.getElementById(id);

const REASONS = {
  no_key: ERRORS.no_key,
  bad_key: 'iksi did not accept the saved key. It may have been revoked. Create a new key in your dashboard and paste it here.'
};

function setStatus(text, isError = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.setAttribute('role', isError ? 'alert' : 'status');
}

function showSaved(key) {
  $('saved-row').hidden = !key;
  $('saved-prefix').textContent = key ? keyPrefix(key) : '';
  $('key-label').textContent = key ? 'Replace key' : 'API key';
}

async function init() {
  const reason = new URLSearchParams(location.search).get('reason');
  $('reason').textContent = REASONS[reason] ?? '';

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  showSaved(apiKey);

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = $('key').value.trim();
    if (!isKeyFormat(key)) {
      setStatus('That is not an iksi key. Keys start with iksi_ and come from your dashboard.', true);
      return;
    }
    await chrome.storage.sync.set({ apiKey: key });
    $('key').value = '';
    $('reason').textContent = '';
    showSaved(key);
    setStatus('Key saved. Right-click any link or page to shorten it.');
  });

  $('remove').addEventListener('click', async () => {
    await chrome.storage.sync.remove('apiKey');
    showSaved(null);
    setStatus('Key removed.');
    $('key').focus();
  });

  $('key').focus();
}

init();
