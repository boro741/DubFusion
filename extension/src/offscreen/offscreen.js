// Offscreen doc — simple beep for proof
let ctx;
function ensureCtx() {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}
function beep() {
  const a = ensureCtx();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = 440;
  g.gain.value = 0.12;
  osc.connect(g).connect(a.destination);
  const t = a.currentTime;
  osc.start(t);
  osc.stop(t + 0.4);
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'DF_OSC_BEEP') beep();
});
