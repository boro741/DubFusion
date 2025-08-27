# DubFusion Step 6: TTS Probe Implementation

## Overview
This implementation adds a non-streaming TTS probe that tests the selected TTS provider with a short audio clip and plays it through the offscreen WebAudio pipeline.

## Features Implemented

### 1. TTS Probe Button
- **Button**: "🔊 Test TTS" button added to both main and fallback UI
- **Placement**: Next to existing buttons (DubFusion, Captions, Rewrite, Settings)
- **Styling**: Blue color (#17a2b8) to distinguish from other controls
- **Functionality**: Single-click test of TTS provider configuration

### 2. Background Service Worker
- **TTS Provider Adapters**: Pluggable adapter pattern for different providers
- **OpenAI Implementation**: Full working implementation with TTS-1 model
- **Stub Implementations**: Placeholder adapters for ElevenLabs, Azure, Google
- **Secure Storage**: Reads settings from sync storage, secrets from local storage
- **Error Handling**: Comprehensive error messages for various failure scenarios

### 3. Offscreen Audio Playback
- **Audio Context Management**: Reuses existing AudioContext for efficiency
- **MP3 Decoding**: Handles MP3 audio from TTS providers
- **Overlap Prevention**: Stops previous audio before playing new audio
- **Base64 Transfer**: Converts ArrayBuffer to base64 for message passing

### 4. Content Script Integration
- **Status Tracking**: Real-time status updates in debug overlay
- **Error Display**: Shows helpful error messages in overlay
- **Auto-clear**: Status messages automatically clear after 3-5 seconds
- **Provider Display**: Shows current TTS provider in debug header

## Technical Implementation

### Provider Adapter Pattern
```javascript
function selectProviderAdapter(providerName) {
  switch (providerName) {
    case 'OpenAI':
      return {
        synthesize: async (testText, voiceHint, settings, secrets) => {
          // OpenAI TTS-1 API implementation
        }
      };
    // Other providers...
  }
}
```

### Message Flow
1. **Content Script** → Sends `DF_TTS_PROBE_REQUEST`
2. **Background** → Reads settings/secrets, calls provider API
3. **Background** → Sends `DF_OSC_PLAY_AUDIO` to offscreen
4. **Offscreen** → Decodes and plays audio
5. **Background** → Returns success/error to content script
6. **Content Script** → Updates debug overlay

### Security Features
- **Secret Isolation**: API keys never exposed to content script
- **Local Storage**: Secrets stored only in chrome.storage.local
- **Background Only**: All API calls made from background service worker
- **No Logging**: Secrets never logged to console

## Provider Implementations

### OpenAI (Fully Implemented)
- **Endpoint**: `https://api.openai.com/v1/audio/speech`
- **Model**: `tts-1`
- **Format**: MP3 response
- **Voice**: Uses voice hint or defaults to 'alloy'
- **Authentication**: Bearer token from API key

### ElevenLabs (Stub)
- **Status**: "ElevenLabs TTS not implemented yet"
- **Validation**: Checks for API key presence
- **Future**: Ready for full implementation

### Azure Speech (Stub)
- **Status**: "Azure Speech TTS not implemented yet"
- **Validation**: Checks for API key and region
- **Future**: Ready for full implementation

### Google Cloud TTS (Stub)
- **Status**: "Google Cloud TTS not implemented yet"
- **Validation**: Checks for credentials
- **Future**: Ready for full implementation

## UI/UX Features

### Debug Overlay Status Messages
- **Idle**: No TTS status shown
- **Probing**: "TTS probe… (Provider)"
- **Success**: "TTS probe: playing ✓" (clears after 3s)
- **Error**: "TTS probe failed: [reason]" (clears after 5s)

### Error Handling
- **No Provider**: "Select a TTS provider in Settings."
- **Missing Key**: "[Provider] API key not configured"
- **API Error**: "OpenAI API error: [status] - [details]"
- **Network Error**: "TTS probe failed: network error"

## Testing

### Manual Test Scenarios
1. **No Provider**: Set provider to "None" → click Test TTS → verify error
2. **Missing Key**: Select provider without API key → verify error
3. **Valid Setup**: Configure OpenAI with valid key → verify audio plays
4. **Network Error**: Use invalid key → verify API error message
5. **Other Providers**: Test ElevenLabs/Azure/Google → verify "not implemented"

### Test Files
- `test-tts-probe.html` - Comprehensive testing and troubleshooting tools

## Acceptance Criteria Met

✅ **Provider set**: Options page allows TTS provider selection and API key configuration  
✅ **Test TTS control**: "🔊 Test TTS" button visible on YouTube pages  
✅ **Playback**: Clicking produces audible "DubFusion test voice" speech  
✅ **Overlay feedback**: Shows probe status and success/error messages  
✅ **Error paths**: Comprehensive error handling for all failure scenarios  
✅ **No secrets leak**: API keys never appear in logs or overlay  
✅ **No console errors**: Clean operation across all components  

## Data Flow Architecture

### Content Script
- Sends probe request to background
- Updates debug overlay with status
- Handles success/error responses
- Manages status message timing

### Background Service Worker
- Reads settings and secrets from storage
- Selects appropriate provider adapter
- Makes API calls to TTS services
- Converts audio to base64 for transfer
- Sends audio to offscreen for playback
- Returns results to content script

### Offscreen Document
- Receives audio data from background
- Decodes MP3 audio using WebAudio API
- Manages audio playback and overlap
- Provides low-latency audio output

## Future Enhancements

This implementation provides the foundation for:
- **Streaming TTS**: Real-time audio synthesis
- **Voice Selection**: Dynamic voice switching
- **Audio Caching**: Local storage of synthesized audio
- **Advanced Providers**: Full ElevenLabs, Azure, Google implementations
- **SSML Support**: Rich text-to-speech formatting
- **Audio Effects**: Volume, speed, pitch controls

## Out of Scope (Correctly Excluded)
- No streaming synthesis (non-streaming only)
- No alignment to captions
- No SSML/code-switching
- No caching/IndexedDB
- No real-time voice switching
