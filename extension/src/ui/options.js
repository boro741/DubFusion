// DubFusion Options - Manual Transcript Mode + ElevenLabs TTS

const STORAGE_KEYS = {
  TRANSCRIPT_MODE: 'dfTranscriptMode',
  MANUAL_TRANSCRIPTS: 'dfManualTranscripts',
  TTS_PROVIDER: 'dfTtsProvider',
  ELEVENLABS_API_KEY: 'dfElevenLabsApiKey',
  ELEVENLABS_SETTINGS: 'dfElevenLabsSettings'
};

let currentVideoId = null;
let validatedTranscript = null;

// Persistent audio element and context for test playback
let dfTestAudioEl = null;
let dfTestAudioCtx = null;
let dfTestAudioSource = null;

// Load saved settings
async function loadSettings() {
  try {
    // Load transcript mode
    const { [STORAGE_KEYS.TRANSCRIPT_MODE]: mode } = await chrome.storage.local.get(STORAGE_KEYS.TRANSCRIPT_MODE);
    document.getElementById('transcriptMode').value = mode || 'manual';
    
    // Load TTS provider
    const { [STORAGE_KEYS.TTS_PROVIDER]: provider } = await chrome.storage.sync.get(STORAGE_KEYS.TTS_PROVIDER);
    document.getElementById('ttsProvider').value = provider || 'browser';
    
    // Load ElevenLabs settings
    await loadElevenLabsSettings();
    
    // Show/hide ElevenLabs section based on provider
    updateElevenLabsSection();
    
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

// Load ElevenLabs settings
async function loadElevenLabsSettings() {
  try {
    // Load API key from local storage (secure)
    const { [STORAGE_KEYS.ELEVENLABS_API_KEY]: apiKey } = await chrome.storage.local.get(STORAGE_KEYS.ELEVENLABS_API_KEY);
    const apiKeyInput = document.getElementById('elevenlabsApiKey');
    if (apiKeyInput && apiKey) {
      console.log('[DubFusion Options] Found API key in storage');
      apiKeyInput.value = '••••••••••••••••••••••••••••••••';
      apiKeyInput.setAttribute('data-masked', 'true');
    }
    
    // Load other settings from sync storage
    const { [STORAGE_KEYS.ELEVENLABS_SETTINGS]: settings } = await chrome.storage.sync.get(STORAGE_KEYS.ELEVENLABS_SETTINGS);
    if (settings) {
      const modelIdInput = document.getElementById('elevenlabsModelId');
      const voiceIdInput = document.getElementById('elevenlabsVoiceId');
      const stabilitySlider = document.getElementById('elevenlabsStability');
      const similarityBoostSlider = document.getElementById('elevenlabsSimilarityBoost');
      const styleSlider = document.getElementById('elevenlabsStyle');
      const useSpeakerBoostCheckbox = document.getElementById('elevenlabsUseSpeakerBoost');
      
      if (modelIdInput) modelIdInput.value = settings.modelId || 'eleven_multilingual_v2';
      if (voiceIdInput) voiceIdInput.value = settings.voiceId || '';
      if (stabilitySlider) stabilitySlider.value = settings.stability || 0.5;
      if (similarityBoostSlider) similarityBoostSlider.value = settings.similarityBoost || 0.75;
      if (styleSlider) styleSlider.value = settings.style || 0;
      if (useSpeakerBoostCheckbox) useSpeakerBoostCheckbox.checked = settings.useSpeakerBoost || false;
      
      // Update display values
      updateSliderValues();
    }
  } catch (error) {
    console.error('Failed to load ElevenLabs settings:', error);
  }
}

// Save transcript mode setting
async function saveTranscriptMode() {
  try {
    const mode = document.getElementById('transcriptMode').value;
    await chrome.storage.local.set({ [STORAGE_KEYS.TRANSCRIPT_MODE]: mode });
    showStatus('Transcript mode saved!', 'success');
  } catch (error) {
    console.error('Failed to save transcript mode:', error);
    showStatus('Failed to save transcript mode', 'error');
  }
}

// Save TTS provider setting
async function saveTtsProvider() {
  try {
    const provider = document.getElementById('ttsProvider').value;
    await chrome.storage.sync.set({ [STORAGE_KEYS.TTS_PROVIDER]: provider });
    updateElevenLabsSection();
    showStatus('TTS provider saved!', 'success');
  } catch (error) {
    console.error('Failed to save TTS provider:', error);
    showStatus('Failed to save TTS provider', 'error');
  }
}

// Update ElevenLabs section visibility
function updateElevenLabsSection() {
  const provider = document.getElementById('ttsProvider').value;
  const section = document.getElementById('elevenlabsSection');
  section.style.display = provider === 'elevenlabs' ? 'block' : 'none';
}

// Update slider display values
function updateSliderValues() {
  const stabilitySlider = document.getElementById('elevenlabsStability');
  const similarityBoostSlider = document.getElementById('elevenlabsSimilarityBoost');
  const styleSlider = document.getElementById('elevenlabsStyle');
  
  const stabilityValue = document.getElementById('stabilityValue');
  const similarityBoostValue = document.getElementById('similarityBoostValue');
  const styleValue = document.getElementById('styleValue');
  
  if (stabilitySlider && stabilityValue) {
    stabilityValue.textContent = stabilitySlider.value;
  }
  if (similarityBoostSlider && similarityBoostValue) {
    similarityBoostValue.textContent = similarityBoostSlider.value;
  }
  if (styleSlider && styleValue) {
    styleValue.textContent = styleSlider.value;
  }
}

// Save ElevenLabs settings
async function saveElevenLabsSettings() {
  try {
    const apiKeyInput = document.getElementById('elevenlabsApiKey');
    if (!apiKeyInput) return;
    
    const apiKey = apiKeyInput.value;
    const isMasked = apiKeyInput.getAttribute('data-masked') === 'true';
    
    // Only save API key if it's not masked and not empty
    if (!isMasked && apiKey && apiKey !== '••••••••••••••••••••••••••••••••') {
      console.log('[DubFusion Options] Saving API key to storage');
      await chrome.storage.local.set({ [STORAGE_KEYS.ELEVENLABS_API_KEY]: apiKey });
    }
    
    const settings = {
      modelId: document.getElementById('elevenlabsModelId')?.value || 'eleven_multilingual_v2',
      voiceId: document.getElementById('elevenlabsVoiceId')?.value || '',
      stability: parseFloat(document.getElementById('elevenlabsStability')?.value || '0.5'),
      similarityBoost: parseFloat(document.getElementById('elevenlabsSimilarityBoost')?.value || '0.75'),
      style: parseFloat(document.getElementById('elevenlabsStyle')?.value || '0'),
      useSpeakerBoost: document.getElementById('elevenlabsUseSpeakerBoost')?.checked || false
    };
    
    await chrome.storage.sync.set({ [STORAGE_KEYS.ELEVENLABS_SETTINGS]: settings });
    showElevenLabsStatus('Settings saved!', 'success');
  } catch (error) {
    console.error('Failed to save ElevenLabs settings:', error);
    showElevenLabsStatus('Failed to save settings', 'error');
  }
}

// Show ElevenLabs status message
function showElevenLabsStatus(message, type = '') {
  const status = document.getElementById('elevenlabsStatus');
  status.textContent = message;
  status.className = type;
  
  if (type === 'success') {
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }
}

// List ElevenLabs voices
async function handleListVoices() {
  try {
    showElevenLabsStatus('Fetching voices...', '');
    
    const response = await chrome.runtime.sendMessage({
      action: 'DF_ELEVEN_LIST_VOICES'
    });
    
    if (response.success) {
      displayVoicesList(response.voices);
      showElevenLabsStatus(`Found ${response.voices.length} voices`, 'success');
    } else {
      showElevenLabsStatus(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to list voices:', error);
    showElevenLabsStatus('Failed to fetch voices', 'error');
  }
}

// Display voices list
function displayVoicesList(voices) {
  const container = document.getElementById('voicesListContent');
  const listDiv = document.getElementById('voicesList');
  
  if (voices.length === 0) {
    container.innerHTML = '<p>No voices found. Check your API key.</p>';
  } else {
    const voicesHtml = voices.map(voice => `
      <div style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;" 
           onclick="selectVoice('${voice.voice_id}', '${voice.name}')">
        <strong>${voice.name}</strong><br>
        <small>ID: ${voice.voice_id}</small>
      </div>
    `).join('');
    container.innerHTML = voicesHtml;
  }
  
  listDiv.style.display = 'block';
}

// Select a voice
function selectVoice(voiceId, voiceName) {
  document.getElementById('elevenlabsVoiceId').value = voiceId;
  showElevenLabsStatus(`Selected voice: ${voiceName}`, 'success');
  saveElevenLabsSettings();
}

// Test ElevenLabs TTS
async function handleTestElevenLabs() {
  try {
    showElevenLabsStatus('Testing TTS...', '');
    
    const response = await chrome.runtime.sendMessage({
      action: 'DF_ELEVEN_TEST_TTS',
      text: 'DubFusion test voice'
    });
    
    if (response.success) {
      showElevenLabsStatus('Test audio played successfully!', 'success');
    } else {
      showElevenLabsStatus(`Test failed: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('Failed to test ElevenLabs:', error);
    showElevenLabsStatus('Failed to test TTS', 'error');
  }
}

// Debug storage function
async function debugStorage() {
  try {
    console.log('[DubFusion Options] Debugging storage...');
    
    // Check local storage (API key)
    const localData = await chrome.storage.local.get();
    console.log('[DubFusion Options] Local storage:', localData);
    
    // Check sync storage (settings)
    const syncData = await chrome.storage.sync.get();
    console.log('[DubFusion Options] Sync storage:', syncData);
    
    // Check current form values
    const apiKeyInput = document.getElementById('elevenlabsApiKey');
    const modelIdInput = document.getElementById('elevenlabsModelId');
    const voiceIdInput = document.getElementById('elevenlabsVoiceId');
    
    console.log('[DubFusion Options] Form values:');
    console.log('  API Key input:', apiKeyInput ? apiKeyInput.value : 'null');
    console.log('  API Key masked:', apiKeyInput ? apiKeyInput.getAttribute('data-masked') : 'null');
    console.log('  Model ID:', modelIdInput ? modelIdInput.value : 'null');
    console.log('  Voice ID:', voiceIdInput ? voiceIdInput.value : 'null');
    
    // Check specific storage keys
    const apiKeyFromStorage = await chrome.storage.local.get(STORAGE_KEYS.ELEVENLABS_API_KEY);
    const settingsFromStorage = await chrome.storage.sync.get(STORAGE_KEYS.ELEVENLABS_SETTINGS);
    
    console.log('[DubFusion Options] Storage check:');
    console.log('  API Key from storage:', apiKeyFromStorage);
    console.log('  Settings from storage:', settingsFromStorage);
    console.log('  Voice ID from storage:', settingsFromStorage[STORAGE_KEYS.ELEVENLABS_SETTINGS]?.voiceId);
    
    showElevenLabsStatus('Storage debug info logged to console', 'info');
  } catch (error) {
    console.error('Failed to debug storage:', error);
    showElevenLabsStatus('Failed to debug storage', 'error');
  }
}

// Validate JSON transcript
function validateTranscript(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    
    // Support both array format and object format with captions array
    let captionsArray;
    let title = 'No title found';
    
    if (Array.isArray(data)) {
      // Legacy array format
      captionsArray = data;
    } else if (data && typeof data === 'object' && Array.isArray(data.captions)) {
      // New format with title and captions array
      captionsArray = data.captions;
      title = data.title || 'No title found';
    } else {
      throw new Error('Transcript must be a JSON array or object with captions array');
    }
    
    if (captionsArray.length === 0) {
      throw new Error('Transcript cannot be empty');
    }
    
    const cues = [];
    let lastStartSec = -1;
    
    for (let i = 0; i < captionsArray.length; i++) {
      const entry = captionsArray[i];
      
      // Check required fields - support both 'duration' and 'dur'
      const start = parseFloat(entry.start);
      const duration = parseFloat(entry.duration || entry.dur);
      const text = entry.text;
      
      if (isNaN(start) || isNaN(duration) || typeof text !== 'string') {
        throw new Error(`Entry ${i}: missing or invalid start, duration/dur, or text fields`);
      }
      
      if (start < 0) {
        throw new Error(`Entry ${i}: start time cannot be negative`);
      }
      
      if (duration <= 0) {
        throw new Error(`Entry ${i}: duration must be positive`);
      }
      
      if (!text.trim()) {
        throw new Error(`Entry ${i}: text cannot be empty`);
      }
      
      // Check for overlapping/out-of-order entries
      if (start < lastStartSec) {
        throw new Error(`Entry ${i}: start time (${start}) is before previous entry`);
      }
      
      const endSec = start + duration;
      const cue = {
        id: `m:${i}`,
        startSec: start,
        endSec: endSec,
        text: text.trim()
      };
      
      cues.push(cue);
      lastStartSec = start;
    }
    
    return {
      valid: true,
      cues: cues,
      count: cues.length,
      firstTime: cues[0].startSec,
      lastTime: cues[cues.length - 1].endSec,
      title: title
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// Show status message
function showStatus(message, type = '') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;
  
  if (type === 'success') {
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }
}

// Show transcript summary
function showSummary(result) {
  const summary = document.getElementById('summary');
  const firstTime = formatTime(result.firstTime);
  const lastTime = formatTime(result.lastTime);
  
  summary.innerHTML = `
    <strong>Transcript validated successfully!</strong><br>
    <strong>Title:</strong> ${result.title}<br>
    cues: <strong>${result.count}</strong> • first: <strong>${firstTime}</strong> • last: <strong>${lastTime}</strong>
  `;
  summary.style.display = 'block';
}

// Format time as mm:ss
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get current video ID from active tab
async function getCurrentVideoId() {
  try {
    console.log('[DubFusion Options] Getting current video ID...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('[DubFusion Options] Current tab:', tab.url);
    
    if (tab.url && tab.url.includes('youtube.com/watch')) {
      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');
      console.log('[DubFusion Options] Found video ID:', videoId);
      return videoId;
    } else {
      console.log('[DubFusion Options] Not a YouTube watch page:', tab.url);
    }
  } catch (error) {
    console.error('[DubFusion Options] Failed to get current video ID:', error);
  }
  return null;
}

// Validate button handler
async function handleValidate() {
  const jsonText = document.getElementById('transcriptJson').value.trim();
  
  if (!jsonText) {
    showStatus('Please paste a JSON transcript', 'error');
    return;
  }
  
  const result = validateTranscript(jsonText);
  
  if (result.valid) {
    validatedTranscript = result;
    document.getElementById('save').disabled = false;
    showStatus('Transcript is valid!', 'success');
    showSummary(result);
  } else {
    validatedTranscript = null;
    document.getElementById('save').disabled = true;
    showStatus(`Validation failed: ${result.error}`, 'error');
    document.getElementById('summary').style.display = 'none';
  }
}

// Save button handler
async function handleSave() {
  if (!validatedTranscript) {
    showStatus('Please validate the transcript first', 'error');
    return;
  }
  
  // Get video ID (prioritize manual input, then auto-detect)
  let videoId = document.getElementById('videoId').value.trim();
  if (!videoId) {
    videoId = await getCurrentVideoId();
  }
  
  if (!videoId) {
    showStatus('Please enter a YouTube video ID or navigate to a YouTube video first', 'error');
    return;
  }
  
  try {
    console.log('[DubFusion Options] Saving transcript for video ID:', videoId);
    
    // Load existing transcripts
    const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: existingTranscripts = {} } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
    
    // Add new transcript
    existingTranscripts[videoId] = {
      cues: validatedTranscript.cues,
      title: validatedTranscript.title,
      savedAt: new Date().toISOString()
    };
    
    // Save to storage
    await chrome.storage.local.set({ [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: existingTranscripts });
    
    // Verify save
    const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: savedTranscripts } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
    console.log('[DubFusion Options] Saved transcripts:', savedTranscripts);
    
    showStatus(`Transcript saved for video ${videoId}!`, 'success');
    document.getElementById('videoId').value = videoId;
    
  } catch (error) {
    console.error('[DubFusion Options] Failed to save transcript:', error);
    showStatus('Failed to save transcript', 'error');
  }
}

// Load existing transcript for current video
async function loadExistingTranscript() {
  try {
    const videoId = await getCurrentVideoId();
    if (videoId) {
      document.getElementById('videoId').value = videoId;
      
      const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: transcripts = {} } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
      const existing = transcripts[videoId];
      
      if (existing) {
        // Convert back to JSON format for display
        const jsonData = {
          title: existing.title,
          captions: existing.cues.map(cue => ({
            start: cue.startSec.toString(),
            dur: (cue.endSec - cue.startSec).toString(),
            text: cue.text
          }))
        };
        
        document.getElementById('transcriptJson').value = JSON.stringify(jsonData, null, 2);
        showStatus(`Loaded existing transcript for video ${videoId}`, 'success');
      }
    }
  } catch (error) {
    console.error('Failed to load existing transcript:', error);
  }
}

// Initialize the options page
async function init() {
  // Load settings
  await loadSettings();
  await loadExistingTranscript();
  
  // Set up event listeners with null checks
  const transcriptMode = document.getElementById('transcriptMode');
  const ttsProvider = document.getElementById('ttsProvider');
  const validateBtn = document.getElementById('validate');
  const saveBtn = document.getElementById('save');
  
  if (transcriptMode) transcriptMode.addEventListener('change', saveTranscriptMode);
  if (ttsProvider) ttsProvider.addEventListener('change', saveTtsProvider);
  if (validateBtn) validateBtn.addEventListener('click', handleValidate);
  if (saveBtn) saveBtn.addEventListener('click', handleSave);
  
  // ElevenLabs event listeners with null checks
  const listVoicesBtn = document.getElementById('listVoices');
  const testElevenLabsBtn = document.getElementById('testElevenLabs');
  const debugStorageBtn = document.getElementById('debugStorage');
  
  if (listVoicesBtn) listVoicesBtn.addEventListener('click', handleListVoices);
  if (testElevenLabsBtn) testElevenLabsBtn.addEventListener('click', handleTestElevenLabs);
  if (debugStorageBtn) debugStorageBtn.addEventListener('click', debugStorage);
  
  // Slider event listeners with null checks
  const stabilitySlider = document.getElementById('elevenlabsStability');
  const similarityBoostSlider = document.getElementById('elevenlabsSimilarityBoost');
  const styleSlider = document.getElementById('elevenlabsStyle');
  
  if (stabilitySlider) stabilitySlider.addEventListener('input', updateSliderValues);
  if (similarityBoostSlider) similarityBoostSlider.addEventListener('input', updateSliderValues);
  if (styleSlider) styleSlider.addEventListener('input', updateSliderValues);
  
  // Auto-save ElevenLabs settings on change with null checks
  const modelIdInput = document.getElementById('elevenlabsModelId');
  const voiceIdInput = document.getElementById('elevenlabsVoiceId');
  const useSpeakerBoostCheckbox = document.getElementById('elevenlabsUseSpeakerBoost');
  
  if (modelIdInput) modelIdInput.addEventListener('change', saveElevenLabsSettings);
  if (voiceIdInput) voiceIdInput.addEventListener('change', saveElevenLabsSettings);
  if (stabilitySlider) stabilitySlider.addEventListener('change', saveElevenLabsSettings);
  if (similarityBoostSlider) similarityBoostSlider.addEventListener('change', saveElevenLabsSettings);
  if (styleSlider) styleSlider.addEventListener('change', saveElevenLabsSettings);
  if (useSpeakerBoostCheckbox) useSpeakerBoostCheckbox.addEventListener('change', saveElevenLabsSettings);
  
  // Handle API key input (unmask when user starts typing)
  const apiKeyInput = document.getElementById('elevenlabsApiKey');
  if (apiKeyInput) {
    apiKeyInput.addEventListener('focus', function() {
      if (this.getAttribute('data-masked') === 'true') {
        this.value = '';
        this.removeAttribute('data-masked');
      }
    });
    
    apiKeyInput.addEventListener('blur', function() {
      if (this.value && this.value !== '••••••••••••••••••••••••••••••••') {
        saveElevenLabsSettings();
      }
    });
  }
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', init);
