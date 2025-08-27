# DubFusion – Hello World

Minimal MV3 extension to prove:
- Content script UI injects on YouTube
- Offscreen Document for WebAudio (beep)
- Simple ducking of the original YouTube audio

## Load in Chrome
1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select the `dubfusion/` folder.
4. Open any YouTube video page.
5. Click **"DubFusion (Hello)"** button near the title/metadata.
   - You should hear a short beep.
   - The YouTube audio volume will duck to ~10% and toggle back on subsequent clicks.

## Next Steps
- Replace beep with streaming TTS audio.
- Add settings UI (style prompt, Hinglish mix, voice).
- Add IndexedDB caching in Offscreen or SW.
