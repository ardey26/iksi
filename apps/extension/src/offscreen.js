// Offscreen document (reason CLIPBOARD): the background worker sends the
// short link here because a service worker cannot touch the clipboard.
// An offscreen document is never focused, so navigator.clipboard is
// refused; a selected textarea and execCommand('copy') still work.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'copy') return false;
  sendResponse({ ok: copy(String(message.text ?? '')) });
  return false;
});

function copy(text) {
  const area = document.getElementById('clip');
  area.value = text;
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.value = '';
  }
}
