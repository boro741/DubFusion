// offscreen.js
let audioCtx;

function ensureCtx() {
  if (!audioCtx) {
    console.log('DubFusion: Creating new AudioContext');
    audioCtx = new AudioContext({ latencyHint: 'interactive' });
  }
  return audioCtx;
}

async function playBeep() {
  console.log('DubFusion: Playing beep sound...');
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 440; // A4
  gain.gain.value = 0.12;    // modest volume

  osc.connect(gain).connect(ctx.destination);
  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + 0.5); // 500ms
  console.log('DubFusion: Beep scheduled to play for 500ms');
}

chrome.runtime.onMessage.addListener((msg) => {
  console.log('DubFusion: Offscreen received message:', msg);
  if (msg?.type === 'DF_OSC_PLAY_BEEP') {
    console.log('DubFusion: Playing beep from offscreen');
    playBeep();
  }
});
