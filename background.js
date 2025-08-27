// background.js (MV3 service worker)

const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreen() {
  console.log('DubFusion: Ensuring offscreen document exists...');
  const exists = await chrome.offscreen.hasDocument?.();
  if (!exists) {
    console.log('DubFusion: Creating offscreen document...');
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play low-latency WebAudio for DubFusion hello world.'
    });
    console.log('DubFusion: Offscreen document created successfully');
  } else {
    console.log('DubFusion: Offscreen document already exists');
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('DubFusion: Background received message:', msg, 'from:', sender);
  
  (async () => {
    if (msg?.type === 'DF_PLAY_BEEP') {
      console.log('DubFusion: Processing DF_PLAY_BEEP message');
      await ensureOffscreen();
      chrome.runtime.sendMessage({ type: 'DF_OSC_PLAY_BEEP' });
      console.log('DubFusion: Sent DF_OSC_PLAY_BEEP to offscreen');
      sendResponse({ ok: true });
    } else if (msg?.type === 'DF_TOGGLE_DUCK') {
      console.log('DubFusion: Processing DF_TOGGLE_DUCK message');
      // Relay to content script to toggle mute/duck on the page
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'DF_TOGGLE_DUCK' });
        console.log('DubFusion: Sent DF_TOGGLE_DUCK to tab', sender.tab.id);
      } else {
        console.warn('DubFusion: No sender tab ID for DF_TOGGLE_DUCK');
      }
      sendResponse({ ok: true });
    }
  })();
  // Return true to signal async sendResponse
  return true;
});

// Clean up when extension is disabled/unloaded (Chrome handles offscreen close automatically)
