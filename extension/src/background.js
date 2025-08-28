// MV3 Service Worker — event-driven brain of the extension

const OFFSCREEN_URL = chrome.runtime.getURL('src/offscreen/offscreen.html');
let creatingOffscreen;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument?.()) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play TTS audio via WebAudio in offscreen document.'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[DubFusion] Installed');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'DF_HELLO_BEEP') {
        await ensureOffscreen();
        chrome.runtime.sendMessage({ type: 'DF_OSC_BEEP' });
        sendResponse({ ok: true });
      } else if (msg?.action === 'DF_ELEVEN_LIST_VOICES') {
        const response = await handleElevenLabsListVoices();
        sendResponse(response);
      } else if (msg?.action === 'DF_ELEVEN_TEST_TTS') {
        const response = await handleElevenLabsTestTTS(msg.text);
        sendResponse(response);
      } else if (msg?.action === 'DF_ELEVEN_SYNTHESIZE') {
        const response = await handleElevenLabsSynthesize(msg.text);
        sendResponse(response);
      }
    } catch (error) {
      console.error('[DubFusion Background] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  return true; // keep sendResponse alive
});

// ElevenLabs API handlers
async function handleElevenLabsListVoices() {
  try {
    // Get API key from secure storage
    const { dfElevenLabsApiKey: apiKey } = await chrome.storage.local.get('dfElevenLabsApiKey');
    
    console.log('[DubFusion Background] Checking for API key in storage');
    console.log('[DubFusion Background] API key found:', apiKey ? 'Yes' : 'No');
    
    if (!apiKey) {
      console.log('[DubFusion Background] No API key found in storage');
      return { success: false, error: 'API key not found. Please enter your ElevenLabs API key.' };
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch voices';
      
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid API key';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (response.status >= 500) {
        errorMessage = 'ElevenLabs service error';
      }
      
      return { success: false, error: errorMessage };
    }
    
    const data = await response.json();
    const voices = data.voices.map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name
    }));
    
    return { success: true, voices };
    
  } catch (error) {
    console.error('[DubFusion Background] Error listing voices:', error);
    return { success: false, error: 'Network error: ' + error.message };
  }
}

async function handleElevenLabsSynthesize(text) {
  // This function is similar to the test one, but returns the audio buffer
  try {
    console.log('[DubFusion Background] Starting synthesis for text:', text);
    const { dfElevenLabsApiKey: apiKey } = await chrome.storage.local.get('dfElevenLabsApiKey');
    const { dfElevenLabsSettings: settings } = await chrome.storage.sync.get('dfElevenLabsSettings');

    if (!apiKey || !settings || !settings.voiceId) {
      console.error('[DubFusion Background] Missing API key or voice configuration');
      return { success: false, error: 'API key or voice not configured.' };
    }

    console.log('[DubFusion Background] Using voice ID:', settings.voiceId);

    // Make sure offscreen is ready
    await ensureOffscreen();

    const requestBody = {
      text: text,
      model_id: settings.modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: settings.stability || 0.5,
        similarity_boost: settings.similarityBoost || 0.75,
        style: settings.style || 0,
        use_speaker_boost: settings.useSpeakerBoost || false
      }
    };

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[DubFusion Background] ElevenLabs API error: ${response.status}`, errorText);
      return { success: false, error: `ElevenLabs API error: ${response.status}` };
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer();
    console.log('[DubFusion Background] Got audio buffer, size:', audioBuffer.byteLength);

    // Convert ArrayBuffer to a serializable format (an array of numbers)
    const serializedBuffer = Array.from(new Uint8Array(audioBuffer));

    console.log('[DubFusion Background] Sending audio to offscreen for playback');
    
    // Send audio to offscreen for playback
    chrome.runtime.sendMessage({
      type: 'DF_OSC_PLAY_AUDIO',
      mimeType: 'audio/mpeg',
      arrayBuffer: serializedBuffer
    });
    console.log('[DubFusion Background] Audio sent to offscreen');
    
    // Return success to content script
    return { success: true, message: 'Audio sent to offscreen for playback' };

  } catch (error) {
    console.error('[DubFusion Background] Error during synthesis:', error);
    return { success: false, error: 'Synthesis network error: ' + error.message };
  }
}

async function handleElevenLabsTestTTS(text) {
  try {
    // Get API key and settings from storage
    const { dfElevenLabsApiKey: apiKey } = await chrome.storage.local.get('dfElevenLabsApiKey');
    const { dfElevenLabsSettings: settings } = await chrome.storage.sync.get('dfElevenLabsSettings');
    
    console.log('[DubFusion Background] Test TTS - Checking for API key in storage');
    console.log('[DubFusion Background] Test TTS - API key found:', apiKey ? 'Yes' : 'No');
    console.log('[DubFusion Background] Test TTS - Settings found:', settings ? 'Yes' : 'No');
    console.log('[DubFusion Background] Test TTS - Settings content:', settings);
    console.log('[DubFusion Background] Test TTS - Voice ID in settings:', settings?.voiceId);
    
    if (!apiKey) {
      console.log('[DubFusion Background] Test TTS - No API key found in storage');
      return { success: false, error: 'API key not found. Please enter your ElevenLabs API key.' };
    }
    
    if (!settings || !settings.voiceId) {
      console.log('[DubFusion Background] Test TTS - No settings or voiceId found');
      console.log('[DubFusion Background] Test TTS - Settings object:', settings);
      return { success: false, error: 'Voice ID not configured. Please select a voice.' };
    }

    // Prepare request body
    const requestBody = {
      text: text,
      model_id: settings.modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: settings.stability || 0.5,
        similarity_boost: settings.similarityBoost || 0.75,
        style: settings.style || 0,
        use_speaker_boost: settings.useSpeakerBoost || false
      }
    };
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${settings.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to generate speech';
      
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'Invalid API key';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (response.status >= 500) {
        errorMessage = 'ElevenLabs service error';
      }
      
      return { success: false, error: errorMessage };
    }
    
    // Get audio data
    const audioBuffer = await response.arrayBuffer();
    console.log('[DubFusion Background] Got audio buffer, size:', audioBuffer.byteLength);
    
    // Ensure offscreen is ready and send audio
    await ensureOffscreen();
    console.log('[DubFusion Background] Sending audio to offscreen...');

    // Convert ArrayBuffer to Uint8Array for serialization
    const uint8Array = new Uint8Array(audioBuffer);
    const serializedBuffer = Array.from(uint8Array);
    
    // Send audio to offscreen for playback
    chrome.runtime.sendMessage({
      type: 'DF_OSC_PLAY_AUDIO',
      mimeType: 'audio/mpeg',
      arrayBuffer: serializedBuffer
    });
    console.log('[DubFusion Background] Audio sent to offscreen');
    
    return { success: true };
    
  } catch (error) {
    console.error('[DubFusion Background] Error testing TTS:', error);
    return { success: false, error: 'Network error: ' + error.message };
  }
}
