# DubFusion Step 5: TTS Provider Options Implementation

## Overview
This implementation extends the Options page to collect TTS provider preferences and API credentials, with proper separation between sensitive and non-sensitive data storage.

## Features Implemented

### 1. TTS Provider Selection
- **Dropdown Options**: None (default), ElevenLabs, Azure Speech, Google Cloud TTS, OpenAI TTS/Realtime
- **Conditional Fields**: Provider-specific fields appear/disappear based on selection
- **Validation**: Real-time validation of required fields with non-blocking warnings

### 2. Provider-Specific Fields

#### ElevenLabs
- **API Key**: Password field with masking
- **Placeholder**: "•••• set ••••" when key is stored

#### Azure Speech
- **API Key**: Password field with masking
- **Region**: Text field for Azure region (e.g., eastus, westus2)
- **Both fields required**: Validation ensures both are filled

#### Google Cloud TTS
- **API Key/Service Account JSON**: Textarea for either API key or full JSON content
- **Flexible input**: Accepts both simple API keys and complex JSON

#### OpenAI
- **API Key**: Password field with masking
- **Standard format**: OpenAI API key format

#### Common Field
- **Voice Hint**: Optional text field for preferred voice ID/name
- **Examples**: "Rachel", "en-US-JennyNeural", or voice ID

### 3. Storage Architecture

#### Chrome Storage Sync (dfSettings)
```javascript
{
  "stylePrompt": "string",
  "mix": 70,
  "glossary": ["API", "class", "state"],
  "ttsProvider": "None | ElevenLabs | Azure | Google | OpenAI",
  "ttsVoiceHint": "string",
  "version": 2
}
```

#### Chrome Storage Local (dfSecrets)
```javascript
{
  "elevenApiKey": "string | undefined",
  "azureKey": "string | undefined", 
  "azureRegion": "string | undefined",
  "googleKeyOrSA": "string | undefined",
  "openaiKey": "string | undefined"
}
```

### 4. Security Features
- **Secret Masking**: API keys displayed as "•••• set ••••" when stored
- **Local Storage**: Secrets stored only locally (chrome.storage.local)
- **No Sync**: Sensitive data never synced across devices
- **Clear Secrets**: Dedicated button to wipe all secrets

### 5. Schema Versioning
- **Version 2**: Current schema with TTS support
- **Migration**: Automatic upgrade from v1 to v2
- **Future-proof**: Easy to add new versions

### 6. Content Script Integration
- **Debug Header**: Shows "TTS:[Provider]" in debug overlay
- **Settings Flow**: Reads ttsProvider from sync storage
- **No Secrets**: Content script never accesses secret storage

## Technical Implementation

### Key Functions Added

#### Options.js
- `showProviderFields(provider)` - Dynamic field visibility
- `validateProviderFields(provider)` - Real-time validation
- `maskSecretField(field, hasValue)` - Secret masking logic
- `clearSecrets()` - Wipe all secrets
- Schema migration handling

#### Content Script
- Updated debug header to include TTS provider
- Enhanced `updateDebugOverlay()` function

### UI/UX Features
- **Clean Layout**: Organized sections with proper spacing
- **Visual Feedback**: Validation warnings, save confirmations
- **Responsive Design**: Proper field sizing and alignment
- **Accessibility**: Proper labels and form structure

### Validation Rules
- **ElevenLabs**: API key required
- **Azure**: Both API key and region required
- **Google**: API key or service account JSON required
- **OpenAI**: API key required
- **None**: No validation (default state)

## Testing

### Manual Test Scenarios
1. **Basic Flow**: Select provider → enter credentials → save → reload → verify masking
2. **Provider Switch**: Change providers → verify fields update correctly
3. **Validation**: Leave required fields empty → verify warnings appear
4. **Clear Secrets**: Save secrets → clear → verify they're gone
5. **Defaults**: Restore defaults → verify only non-sensitive fields reset
6. **Content Script**: Verify debug header shows TTS provider

### Test Files
- `test-tts-options.html` - Storage inspection and testing tools

## Acceptance Criteria Met

✅ **Options shows provider section** with dropdown + conditional fields  
✅ **Switching provider** shows appropriate secret inputs  
✅ **Save persists** - reload options → selections/inputs remain; secrets masked  
✅ **Restore defaults** resets non-sensitive fields only; secrets remain  
✅ **Clear secrets** removes secrets; reload shows empty fields  
✅ **Content script header** shows • TTS:[provider] on YouTube page  
✅ **No network calls** - purely local storage operations  
✅ **No console errors** in Options or content-script  

## Data Flow

### Options Page
1. Load both sync and local storage
2. Populate fields with current values
3. Mask secret fields appropriately
4. Show validation warnings if needed
5. Save to both storages on submit

### Content Script
1. Load settings from sync storage only
2. Display TTS provider in debug header
3. No access to secret storage

## Security Considerations

- **No Network Calls**: All operations are local
- **Secret Isolation**: Secrets never leave local storage
- **Masking**: Real values never displayed in UI
- **Validation**: Client-side only, no server validation
- **Clear Function**: Easy way to remove all secrets

## Future Enhancements

This implementation provides the foundation for:
- Real TTS API integration in Step 6
- Voice selection and preview
- Advanced validation and error handling
- Provider-specific configuration options
- Usage tracking and limits

## Out of Scope (Correctly Excluded)
- No validation against real endpoints
- No usage of secrets for API calls
- No IndexedDB changes
- No background/offscreen modifications
