// DubFusion Options - Manual Transcript Mode

const STORAGE_KEYS = {
  TRANSCRIPT_MODE: 'dfTranscriptMode',
  MANUAL_TRANSCRIPTS: 'dfManualTranscripts'
};

let currentVideoId = null;
let validatedTranscript = null;

// Load saved settings
async function loadSettings() {
  try {
    const { [STORAGE_KEYS.TRANSCRIPT_MODE]: mode } = await chrome.storage.local.get(STORAGE_KEYS.TRANSCRIPT_MODE);
    document.getElementById('transcriptMode').value = mode || 'manual';
  } catch (error) {
    console.error('Failed to load settings:', error);
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
  
  // Get video ID from input field or try to detect from current tab
  let videoId = document.getElementById('videoId').value.trim();
  
  if (!videoId) {
    console.log('[DubFusion Options] No manual video ID, trying to detect from current tab...');
    videoId = await getCurrentVideoId();
  }
  
  if (!videoId) {
    showStatus('Please enter a YouTube video ID or navigate to a YouTube video first', 'error');
    return;
  }
  
  console.log('[DubFusion Options] Saving transcript for video ID:', videoId);
  
  try {
    // Get existing transcripts
    const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: transcripts = {} } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
    console.log('[DubFusion Options] Existing transcripts:', Object.keys(transcripts));
    
    // Save transcript for this video
    transcripts[videoId] = validatedTranscript.cues;
    
    await chrome.storage.local.set({ [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: transcripts });
    
    // Verify the save worked
    const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: savedTranscripts = {} } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
    console.log('[DubFusion Options] After save, transcripts:', Object.keys(savedTranscripts));
    
    showStatus(`Transcript saved for video ${videoId}!`, 'success');
    currentVideoId = videoId;
    
  } catch (error) {
    console.error('[DubFusion Options] Failed to save transcript:', error);
    showStatus('Failed to save transcript', 'error');
  }
}

// Load existing transcript for current video
async function loadExistingTranscript() {
  const videoId = await getCurrentVideoId();
  
  // Populate video ID field if detected
  if (videoId) {
    document.getElementById('videoId').value = videoId;
    console.log('[DubFusion Options] Auto-populated video ID:', videoId);
  }
  
  if (!videoId) return;
  
  try {
    const { [STORAGE_KEYS.MANUAL_TRANSCRIPTS]: transcripts = {} } = await chrome.storage.local.get(STORAGE_KEYS.MANUAL_TRANSCRIPTS);
    const existingTranscript = transcripts[videoId];
    
    if (existingTranscript) {
      // Convert back to input format - use the new format with title and captions
      const jsonData = {
        title: "No title found", // We don't store title in the internal format, so use default
        captions: existingTranscript.map(cue => ({
          start: cue.startSec.toString(),
          dur: (cue.endSec - cue.startSec).toString(),
          text: cue.text
        }))
      };
      
      document.getElementById('transcriptJson').value = JSON.stringify(jsonData, null, 2);
      showStatus(`Loaded existing transcript for video ${videoId}`, 'success');
    }
  } catch (error) {
    console.error('[DubFusion Options] Failed to load existing transcript:', error);
  }
}

// Initialize
async function init() {
  await loadSettings();
  await loadExistingTranscript();
  
  // Event listeners
  document.getElementById('transcriptMode').addEventListener('change', saveTranscriptMode);
  document.getElementById('validate').addEventListener('click', handleValidate);
  document.getElementById('save').addEventListener('click', handleSave);
  
  // Auto-validate on paste
  document.getElementById('transcriptJson').addEventListener('input', () => {
    document.getElementById('save').disabled = true;
    document.getElementById('summary').style.display = 'none';
  });
}

// Start the app
init();
