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

// TTS Provider Adapters
function selectProviderAdapter(providerName) {
  switch (providerName) {
    case 'OpenAI':
      return {
        synthesize: async (testText, voiceHint, settings, secrets) => {
          if (!secrets.openaiKey) {
            throw new Error('OpenAI API key not configured');
          }
          
          const voice = voiceHint || 'alloy';
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${secrets.openaiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: testText,
              voice: voice,
              response_format: 'mp3'
            })
          });
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          return {
            mimeType: 'audio/mpeg',
            arrayBuffer: arrayBuffer
          };
        }
      };
      
    case 'ElevenLabs':
      return {
        synthesize: async (testText, voiceHint, settings, secrets) => {
          if (!secrets.elevenApiKey) {
            throw new Error('ElevenLabs API key not configured');
          }
          
          // For now, return a stub implementation
          throw new Error('ElevenLabs TTS not implemented yet');
        }
      };
      
    case 'Azure':
      return {
        synthesize: async (testText, voiceHint, settings, secrets) => {
          if (!secrets.azureKey || !secrets.azureRegion) {
            throw new Error('Azure Speech API key or region not configured');
          }
          
          // For now, return a stub implementation
          throw new Error('Azure Speech TTS not implemented yet');
        }
      };
      
    case 'Google':
      return {
        synthesize: async (testText, voiceHint, settings, secrets) => {
          if (!secrets.googleKeyOrSA) {
            throw new Error('Google Cloud TTS credentials not configured');
          }
          
          // For now, return a stub implementation
          throw new Error('Google Cloud TTS not implemented yet');
        }
      };
      
    default:
      throw new Error(`Unknown TTS provider: ${providerName}`);
  }
}

async function handleTTSProbe() {
  try {
    // Read settings and secrets
    const [syncResult, localResult] = await Promise.all([
      chrome.storage.sync.get('dfSettings'),
      chrome.storage.local.get('dfSecrets')
    ]);
    
    const settings = syncResult.dfSettings || {};
    const secrets = localResult.dfSecrets || {};
    
    const provider = settings.ttsProvider;
    const voiceHint = settings.ttsVoiceHint;
    
    if (!provider || provider === 'None') {
      return { success: false, error: 'Select a TTS provider in Settings.' };
    }
    
    // Get provider adapter and synthesize
    const adapter = selectProviderAdapter(provider);
    const testText = 'DubFusion test voice';
    
    console.log(`DubFusion: Synthesizing TTS with ${provider}...`);
    const result = await adapter.synthesize(testText, voiceHint, settings, secrets);
    
    // Ensure offscreen exists and play audio
    await ensureOffscreen();
    
    // Convert ArrayBuffer to base64 for message passing
    const base64 = btoa(String.fromCharCode(...new Uint8Array(result.arrayBuffer)));
    
    // Send to offscreen for playback
    chrome.runtime.sendMessage({
      type: 'DF_OSC_PLAY_AUDIO',
      mimeType: result.mimeType,
      audioData: base64
    });
    
    console.log('DubFusion: TTS audio sent to offscreen for playback');
    return { success: true };
    
  } catch (error) {
    console.error('DubFusion: TTS probe error:', error);
    return { success: false, error: error.message };
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
    } else if (msg?.type === 'DF_TTS_PROBE_REQUEST') {
      console.log('DubFusion: Processing DF_TTS_PROBE_REQUEST message');
      const result = await handleTTSProbe();
      sendResponse(result);
    }
  })();
  // Return true to signal async sendResponse
  return true;
});

// Clean up when extension is disabled/unloaded (Chrome handles offscreen close automatically)
