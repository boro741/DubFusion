// offscreen.js
let audioCtx;
let currentAudioSource = null; // Track current audio to prevent overlap

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

async function playAudio(mimeType, audioData) {
  console.log('DubFusion: Playing TTS audio...');
  
  try {
    // Stop any currently playing audio
    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource = null;
    }
    
    const ctx = ensureCtx();
    
    // Convert base64 back to ArrayBuffer
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    
    // Decode the audio
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // Create and play the audio source
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    currentAudioSource = source;
    source.start(0);
    
    console.log('DubFusion: TTS audio started playing');
    
    // Clean up when audio finishes
    source.onended = () => {
      console.log('DubFusion: TTS audio finished playing');
      currentAudioSource = null;
    };
    
  } catch (error) {
    console.error('DubFusion: Error playing TTS audio:', error);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  console.log('DubFusion: Offscreen received message:', msg);
  if (msg?.type === 'DF_OSC_PLAY_BEEP') {
    console.log('DubFusion: Playing beep from offscreen');
    playBeep();
  } else if (msg?.type === 'DF_OSC_PLAY_AUDIO') {
    console.log('DubFusion: Playing TTS audio from offscreen');
    playAudio(msg.mimeType, msg.audioData);
  }
});
