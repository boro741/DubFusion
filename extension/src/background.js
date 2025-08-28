// MV3 Service Worker — event-driven brain of the extension

const OFFSCREEN_URL = chrome.runtime.getURL('src/offscreen/offscreen.html');

async function ensureOffscreen() {
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const has = await chrome.offscreen.hasDocument();
    if (!has) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Prepare for future WebAudio playback.'
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DubFusion] Installed');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'DF_HELLO_BEEP') {
      await ensureOffscreen();
      chrome.runtime.sendMessage({ type: 'DF_OSC_BEEP' });
      sendResponse({ ok: true });
    }
  })();
  return true; // keep sendResponse alive
});
