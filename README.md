# DubFusion (Hello World)

Minimal Manifest V3 Chrome extension scaffold with:
- Background Service Worker
- Content script that injects a small UI on YouTube
- Popup and Options pages
- Offscreen document stub (future audio)

## Load in Chrome
1) Open `chrome://extensions`
2) Enable **Developer mode**
3) Click **Load unpacked** and select the `extension/` folder
4) Open a YouTube video — you should see "DubFusion (Hello)" injected below the title
5) Click the browser action (puzzle piece → pin) to open the Popup

## Folders
- `extension/src/background.js` — service worker (event-driven)
- `extension/src/content/content-script.js` — page UI injection (YouTube)
- `extension/src/ui/popup.html/js` — toolbar popup
- `extension/src/ui/options.html/js` — extension options page
- `extension/src/offscreen/` — offscreen doc stub (for WebAudio later)
