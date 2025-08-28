// Offscreen doc — audio playback for ElevenLabs TTS
let ctx;
let currentAudio = null;

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

async function playAudio(mimeType, arrayBuffer) {
  try {
    console.log('[DubFusion Offscreen] Starting audio playback...');
    const a = ensureCtx();
    console.log(`[DubFusion Offscreen] Audio context state: ${a.state}`);

    // If context is suspended, try to resume it.
    if (a.state === 'suspended') {
      console.log('[DubFusion Offscreen] Resuming audio context...');
      await a.resume();
    }
    
    // Stop any currently playing audio
    if (currentAudio) {
      console.log('[DubFusion Offscreen] Stopping current audio');
      currentAudio.stop();
      currentAudio = null;
    }
    
    // Decode the audio data
    console.log('[DubFusion Offscreen] Decoding audio data...');
    const audioBuffer = await a.decodeAudioData(arrayBuffer).catch(err => {
      console.error('[DubFusion Offscreen] decodeAudioData error:', err);
      throw err;
    });
    console.log('[DubFusion Offscreen] Audio decoded, duration:', audioBuffer.duration);
    
    // Create and play the audio
    const source = a.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(a.destination);
    source.start();
    console.log('[DubFusion Offscreen] Audio started playing');
    
    currentAudio = source;
    
    // Clean up when done
    source.onended = () => {
      console.log('[DubFusion Offscreen] Audio playback ended');
      currentAudio = null;
    };
    
    console.log('[DubFusion Offscreen] Playing ElevenLabs audio');
    
  } catch (error) {
    console.error('[DubFusion Offscreen] Error playing audio:', error);
  }
}

// Announce readiness once loaded
(async () => {
  try {
    console.log('[DubFusion Offscreen] Document ready, announcing READY');
    chrome.runtime.sendMessage({ type: 'DF_OSC_READY' });
  } catch (err) {
    console.error('[DubFusion Offscreen] Failed to announce READY:', err);
  }
})();

// Listen for messages from both runtime and offscreen API
chrome.runtime.onMessage.addListener((msg) => {
  console.log('[DubFusion Offscreen] Received runtime message:', msg?.type);
  
  if (msg?.type === 'DF_OSC_BEEP') {
    console.log('[DubFusion Offscreen] Playing beep');
    beep();
  } else if (msg?.type === 'DF_OSC_PLAY_AUDIO') {
    console.log('[DubFusion Offscreen] Playing audio, mimeType:', msg.mimeType, 'buffer size:', msg.arrayBuffer?.length);
    
    // Reconstruct ArrayBuffer from serialized data
    if (msg.arrayBuffer && Array.isArray(msg.arrayBuffer)) {
      const uint8Array = new Uint8Array(msg.arrayBuffer);
      const properArrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
      playAudio(msg.mimeType, properArrayBuffer);
    } else {
      console.error('[DubFusion Offscreen] Invalid arrayBuffer data received');
    }
  } else {
    console.log('[DubFusion Offscreen] Unknown message type:', msg?.type);
  }
});


