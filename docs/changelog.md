# DubFusion Changelog

## S2 — CaptionProvider Implementation
**Date:** December 2024  
**Version:** v0.2.0

### Added
- **CaptionProvider Module**: Unified interface for caption access with TextTracks and DOM fallback strategies
- **TextTrackStrategy**: Preferred method using WebVTT cues with automatic track selection
- **DomPollingStrategy**: Fallback strategy for when TextTracks aren't accessible
- **Cues Display**: New section in debug overlay showing next 3 upcoming caption cues
- **Real-time Updates**: Cues section updates every 250ms with current video time
- **SPA Resilience**: CaptionProvider automatically reinitializes for new videos during navigation

### Technical Details
- **TextTracks Integration**: Automatically selects first available subtitles/captions track
- **Track Mode Management**: Sets tracks to 'hidden' mode to access cues without rendering
- **Cue Processing**: Maps WebVTT cues to internal Cue format with sanitized text
- **DOM Fallback**: Polls YouTube caption container every 100ms for visible text changes
- **Synthetic Cues**: Creates timestamped cues from DOM changes with 300-entry buffer
- **Memory Management**: Automatic cleanup of old cues and proper disposal of resources

### Components
- **CaptionProvider**: Main interface with strategy selection and lifecycle management
- **TextTrackStrategy**: Handles WebVTT cues with automatic track detection
- **DomPollingStrategy**: Creates synthetic cues from visible caption text
- **Cues Section**: Shows "[start→end] text" format for next 3 upcoming cues
- **Source Label**: Header now shows "Source: TextTracks" or "Source: DOM"

### Data Contracts
- **Cue Type**: `{ id: string, startSec: number, endSec: number, text: string }`
- **Invariants**: 0 ≤ startSec < endSec, text is non-empty after sanitization
- **ID Format**: TextTracks use "track_X:Y", DOM uses "dom:Z" for uniqueness

### Non-Goals (Future Sprints)
- No batching, rewriting, or TTS functionality yet
- No background/offscreen integration
- No options page integration

### Files Modified
- `extension/src/content/content-script.js` - Added CaptionProvider module and strategies
- `extension/src/content/content.css` - Added cues section styling
- `docs/changelog.md` - Added S2 entry

### Testing Notes
- Test on YouTube videos with English CC enabled (should show TextTracks)
- Test with CC disabled (should show DOM fallback or "none; enable CC")
- Verify SPA navigation reinitializes provider for new videos
- Check that cue times are accurate and increasing
- Confirm no memory leaks during video switches

## S2M — Manual Transcript Mode
**Date:** December 2024  
**Version:** v0.2.1

### Added
- **Manual Transcript Mode**: Support for pasting pre-built JSON transcripts
- **Options UI**: Complete rewrite with transcript mode selection and JSON input
- **ManualTranscriptProvider**: New provider for handling stored JSON transcripts
- **Per-Video Storage**: Transcripts stored per video ID using chrome.storage.local
- **JSON Validation**: Comprehensive validation of transcript format and data integrity
- **Transcript Summary**: Shows cue count, first time, and last time after validation
- **Overlay Integration**: Manual transcripts display in debug overlay with source labeling

### Technical Details
- **Storage**: Transcripts stored under `dfManualTranscripts[videoId]` in chrome.storage.local
- **Data Format**: Normalized to Cue format with `id: "m:<index>"` for manual transcripts
- **Validation**: Checks for required fields, time ordering, and data types
- **Provider Integration**: ManualTranscriptProvider integrates with existing CaptionProvider system
- **Mode Selection**: Options page allows switching between manual and auto modes
- **Video ID Detection**: Automatically extracts video ID from YouTube URLs

### Components
- **Options Page**: Transcript mode selector, JSON textarea, validate/save buttons
- **ManualTranscriptProvider**: Handles loading, caching, and querying of manual transcripts
- **Enhanced Overlay**: Shows "Source: manual" and transcript summary information
- **Validation Engine**: Comprehensive JSON validation with detailed error messages

### Data Contracts
- **Input Format**: `{title: string, captions: [{start: string, dur: string, text: string}, ...]}`
- **Legacy Format**: `[{start: number, duration: number, text: string}, ...]` (still supported)
- **Internal Format**: `{id: "m:X", startSec: number, endSec: number, text: string}`
- **Storage Key**: `dfManualTranscripts[videoId]` for per-video persistence

### Non-Goals (Future Sprints)
- No Browser TTS yet (that's S3M)
- No muting/ducking
- No auto sources (PlayerResponse/timedtext) — manual only for MVP test

### Files Modified
- `extension/src/ui/options.html` - Complete rewrite with manual transcript UI
- `extension/src/ui/options.js` - Complete rewrite with validation and storage logic
- `extension/src/content/content-script.js` - Added ManualTranscriptProvider and integration
- `extension/src/content/content.css` - Added cues summary styling
- `extension/manifest.json` - Added tabs permission for options page
- `docs/changelog.md` - Added S2M entry

### Format Updates
- **S2M.1**: Updated to support new JSON format with title and captions array
  - Added support for `{title, captions: [{start, dur, text}]}` format
  - Maintains backward compatibility with legacy array format
  - Enhanced validation to handle string/number time values
  - Updated placeholder text and help text to show new format
  - Added title display in validation summary
- **S2M.2**: Fixed video ID detection and storage issues
  - Added manual video ID input field for cases where auto-detection fails
  - Enhanced debugging for video ID detection and storage operations
  - Added verification of storage operations to ensure data persistence
  - Improved error messages and user feedback for save operations

### Testing Notes
- Test JSON validation with malformed data (missing fields, invalid types)
- Verify per-video storage and retrieval across different video IDs
- Check overlay display for manual transcripts vs missing transcripts
- Confirm SPA navigation preserves manual transcript state
- Test mode switching between manual and auto modes

---

## S3M — Scheduler (Browser TTS + Mute)
**Date:** December 2024  
**Version:** v0.3.0

### Added
- **Scheduler Class**: Complete Browser TTS scheduling system with timing rules
- **Browser TTS Integration**: Web Speech API integration with preferred voice selection
- **Mute Management**: Intelligent video muting during TTS with state restoration
- **Event Handling**: Robust seek/pause/ratechange handling with proper cleanup
- **Timing Rules**: Early/late/skip logic with configurable thresholds
- **Overlay Integration**: Real-time scheduler statistics in debug overlay

### Technical Details
- **Planning Loop**: 200ms cadence for scheduling upcoming cues
- **State Management**: NEW → SCHEDULED → PLAYING → PLAYED | SKIPPED | CANCELED
- **Mute Guard**: Counter-based muting with previous state restoration
- **Voice Selection**: Automatic English voice selection with fallback
- **Timer Management**: Precise timing with early start and late skip policies
- **Event Resilience**: Proper cleanup on seek, pause, and rate changes

### Components
- **Scheduler**: Main scheduling engine with planning loop and state management
- **Browser TTS**: SpeechSynthesisUtterance integration with error handling
- **Mute Controller**: Video muting with overlap handling and state restoration
- **Event Handlers**: Video event listeners for seek, pause, play, ratechange
- **Statistics**: Real-time play/skip counters in overlay header

### Configuration
- **leadTimeSec**: 2.0s (planning horizon)
- **lateSkipThresholdSec**: 1.0s (late skip threshold)
- **earlyStartSlackMs**: 80ms (early start tolerance)

### Timing Rules
- **Early**: Δ < -0.08s → wait with timer
- **On-time**: -0.08s ≤ Δ ≤ +1.0s → speak immediately
- **Late**: Δ > +1.0s → skip and count

### Non-Goals (Future Sprints)
- No batching changes (uses current cue items)
- No rewrite/LLM integration
- No cloud TTS or offscreen audio

### Files Modified
- `extension/src/content/content-script.js` - Added complete Scheduler class and integration
- `docs/changelog.md` - Added S3M entry

### Testing Notes
- Test with 3-5 minute manual transcript video
- Verify on-time speech (≥90% within 0.8s of startSec)
- Check late-skip behavior for items >1.0s late
- Test mute behavior (mutes during TTS, restores after)
- Verify seek/pause/ratechange handling
- Confirm no console errors during extended playback

### Latency Optimizations (S3M.1)
- **Planning Loop**: Reduced from 200ms to 100ms for faster response
- **Lead Time**: Reduced from 2.0s to 1.5s for quicker scheduling
- **Early Start Slack**: Reduced from 80ms to 50ms for earlier initiation
- **TTS Compensation**: Added 150ms early start compensation for TTS startup latency
- **Speech Pre-warming**: Added silent utterance to warm up speech synthesis
- **Enhanced Logging**: Added latency tracking in console and overlay logs

### Aggressive Latency Reduction (S3M.2)
- **Planning Loop**: Further reduced to 50ms intervals for minimal delay
- **Lead Time**: Reduced to 0.8s for much faster response
- **Early Start Slack**: Reduced to 20ms for very aggressive early start
- **TTS Compensation**: Increased to 400ms compensation for maximum alignment
- **Immediate Start**: Added logic to start cues immediately if they're due or slightly early
- **Speech Rate**: Increased to 1.2x for faster delivery
- **Aggressive Pre-warming**: Enhanced voice loading and immediate pre-warming
- **Speech Cancellation**: Cancel ongoing speech for faster switching between cues

---

## S4M.1 — Batching Engine (Join Rules)
**Date:** December 2024  
**Version:** v0.4.0

### Added
- **Batcher Class**: Complete batching engine with join rules
- **Join Rules**: Converts Cues to Batches using configurable rules
- **Overlay Toggle**: CUES | BATCHES view toggle in debug overlay
- **Batch Display**: Shows next 3 batches with timing and text
- **Configuration**: Batch join rules with constants

### Technical Details
- **Join Rules**: gap ≤ 400ms, joinedDuration ≤ 2.5s, chars ≤ 140
- **Sort & Dedupe**: Automatic sorting by start time and deduplication by ID
- **Batch Structure**: { startSec, endSec, text, cueIds[] }
- **View Toggle**: Interactive toggle between CUES and BATCHES views
- **Default View**: BATCHES view when available, falls back to CUES

### Components
- **Batcher**: Main batching engine with join logic
- **Join Rules**: Configurable rules for merging adjacent cues
- **Overlay Integration**: Toggle functionality and batch display
- **CSS Styling**: Toggle button styles and hover effects

### Configuration
- **batchJoinGapMs**: 400ms (maximum gap between cues)
- **batchMaxDurationSec**: 2.5s (maximum batch duration)
- **batchMaxChars**: 140 (maximum characters per batch)

### Files Modified
- `extension/src/content/content-script.js` - Added Batcher class and overlay toggle
- `extension/src/content/content.css` - Added toggle button styles
- `docs/changelog.md` - Added S4M.1 entry

### Testing Notes
- Verify overlay toggle CUES | BATCHES is visible and functional
- Check that adjacent tiny cues are merged when rules allow
- Confirm no batch violates invariants (0 ≤ start < end, ≤2.5s, ≤140 chars)
- Test SPA navigation preserves toggle state
- Verify batch counts decrease compared to individual cues

---

## E0.2 — ElevenLabs TTS Integration Fix
**Date:** December 2024  
**Version:** v0.4.2

### Fixed
- **In-Video ElevenLabs TTS**: Fixed issue where ElevenLabs TTS was not working during YouTube video playback
- **TTS Provider Detection**: Content script now properly reads TTS provider setting from chrome.storage.sync
- **Scheduler Integration**: Scheduler now correctly switches between Browser TTS and ElevenLabs TTS
- **ArrayBuffer Serialization**: Fixed ArrayBuffer transfer issues for chrome.runtime.sendMessage
- **Offscreen Audio Playback**: Proper reconstruction of ArrayBuffer in offscreen document

### Technical Details
- **TTS Provider Loading**: `updateOverlayHeader()` now reads `dfTtsProvider` from storage and updates scheduler
- **ElevenLabs Synthesis**: `startSynthesis()` method sends `DF_ELEVEN_SYNTHESIZE` messages to background
- **Audio Playback**: `playElevenLabsTTS()` handles different synthesis job states (PLAYED, IN_FLIGHT, FAILED)
- **Mute Management**: Proper video muting during ElevenLabs audio playback with duration estimation
- **Overlay Integration**: Header shows current TTS provider and updates in real-time

### Components
- **Content Script**: Enhanced scheduler with ElevenLabs synthesis and playback logic
- **Background Script**: ElevenLabs synthesis handler with proper ArrayBuffer serialization
- **Offscreen Document**: ArrayBuffer reconstruction and audio playback
- **Overlay**: Real-time TTS provider display in header

### Data Flow
1. Content script detects TTS provider from storage
2. Scheduler triggers ElevenLabs synthesis for upcoming cues
3. Background script fetches audio from ElevenLabs API
4. Audio sent to offscreen document via chrome.runtime.sendMessage
5. Offscreen reconstructs ArrayBuffer and plays audio via WebAudio
6. Video muted during playback, restored after completion

### Files Modified
- `extension/src/content/content-script.js` - Added ElevenLabs TTS integration in scheduler
- `extension/src/background.js` - Enhanced ElevenLabs synthesis with proper ArrayBuffer handling
- `extension/src/offscreen/offscreen.js` - Added ArrayBuffer reconstruction for audio playback

### Testing Notes
- Select ElevenLabs as TTS provider in options page
- Load YouTube video with manual transcript
- Verify overlay shows "TTS: elevenlabs" in header
- Confirm ElevenLabs audio plays during video playback
- Check that video mutes during speech and restores after
- Test seek/pause/ratechange events with ElevenLabs TTS

---

## E0.1 — ElevenLabs Preflight & Settings
**Date:** December 2024  
**Version:** v0.4.1

### Added
- **ElevenLabs TTS Provider**: Added ElevenLabs as selectable TTS provider alongside Browser TTS
- **Options UI**: TTS provider dropdown and comprehensive ElevenLabs configuration section
- **API Key Management**: Secure storage of ElevenLabs API keys in chrome.storage.local
- **Voice Settings**: Model ID, Voice ID, stability, similarity boost, style, and speaker boost controls
- **Voice Listing**: "List Voices" button fetches available voices from ElevenLabs API
- **Test Functionality**: "🔊 Test ElevenLabs" button plays sample audio via offscreen document
- **Overlay Integration**: Shows TTS provider in debug overlay header
- **Error Handling**: Comprehensive error mapping for API failures

### Technical Details
- **Background API Handlers**: DF_ELEVEN_LIST_VOICES and DF_ELEVEN_TEST_TTS
- **Secure Storage**: API keys in local storage, settings in sync storage
- **Offscreen Audio**: Enhanced offscreen.js for MP3 audio playback
- **Voice Settings**: Stability, similarity boost, style, speaker boost controls
- **Error Mapping**: 401/403 (invalid key), 429 (rate limit), 5xx (service error)

### Components
- **Options UI**: TTS provider dropdown and ElevenLabs configuration section
- **Background Service**: ElevenLabs API integration with secure key handling
- **Offscreen Audio**: WebAudio playback for ElevenLabs MP3 responses
- **Overlay Integration**: Real-time TTS provider display in debug overlay

### Configuration
- **Model ID**: eleven_multilingual_v2 (default)
- **Voice Settings**: Stability (0-1), Similarity Boost (0-1), Style (0-1), Speaker Boost (boolean)
- **Storage**: API keys in chrome.storage.local, settings in chrome.storage.sync

### Security Features
- **API Key Masking**: Keys displayed as "••••••••••••••••••••••••••••••••"
- **Secure Storage**: Keys never exposed to content scripts
- **Background Only**: All API calls made from service worker
- **No Console Logging**: Keys never logged to console

### Files Modified
- `extension/src/ui/options.html` - Added TTS provider selection and ElevenLabs settings
- `extension/src/ui/options.js` - Complete ElevenLabs integration and settings management
- `extension/src/background.js` - ElevenLabs API handlers and secure key management
- `extension/src/offscreen/offscreen.js` - Enhanced audio playback for MP3 files
- `extension/src/content/content-script.js` - Overlay integration for TTS provider display

### Testing Notes
- Switch provider to ElevenLabs, paste API key, click List Voices → see names & IDs
- Set voice ID, click 🔊 Test ElevenLabs → audio plays once, video unaffected
- Toggle between tabs and back → Options shows saved values
- Check DevTools → no uncaught errors, network calls show accept: audio/mpeg
- Verify overlay shows "TTS: elevenlabs" when provider is selected
- Test error handling with invalid API key and network failures

---

### Bug Fixes
- **S2.1**: Fixed TextTrackStrategy not detecting captions when CC is ON
  - Added proper event listeners for `loadeddata` and `loadedmetadata` events
  - Improved track selection timing with retry mechanism
  - Added detailed logging for debugging track detection
  - Removed problematic track mode manipulation that interfered with YouTube's caption display
  - Enhanced error handling and retry logic for delayed track loading
  - **S2.2**: Added comprehensive console logging for debugging caption detection
    - Console logs for all CaptionProvider initialization steps
    - Detailed track information logging (kind, mode, language, cue count)
    - Cue processing logs with timing and text content
    - Video element detection and provider lifecycle logging
    - Real-time debugging information for troubleshooting caption issues

---

## S1 — Debug Overlay Scaffold
**Date:** December 2024  
**Version:** v0.1.0

### Added
- **Debug Overlay UI**: Minimal, reusable debug overlay for YouTube watch pages
- **DF Chip**: Small docked chip ("DF") in top-right corner for show/hide toggle
- **Overlay Panel**: Expandable panel with header and log sections
- **Logging System**: Timestamped log entries with 50-entry buffer, showing last 5 visible
- **SPA Navigation Support**: Handles YouTube single-page app navigation without duplicates
- **State Persistence**: Remembers expanded/collapsed state per tab using sessionStorage

### Technical Details
- **Content Script**: Complete rewrite of `content-script.js` with overlay injection logic
- **CSS Styling**: Dark-mode friendly overlay with high z-index (10000) positioning
- **Idempotent Injection**: Prevents duplicate overlays across page refreshes/navigation
- **URL Monitoring**: Detects YouTube route changes via `yt-navigate-finish` events and polling
- **Responsive Design**: Mobile-friendly adjustments for smaller viewports

### Components
- **Header**: Shows "DubFusion • v0 overlay • Source:— • Horizon:+0.0s • Ready:+0.0s"
- **Log Area**: Displays recent debug events (overlay init, show/hide, URL changes)
- **Toggle Logic**: Click DF chip to expand/collapse overlay panel

### Non-Goals (Future Sprints)
- No caption reading, batching, or TTS functionality yet
- No background/offscreen integration
- No options page integration

### Files Modified
- `extension/src/content/content-script.js` - Complete rewrite
- `extension/src/content/content.css` - Complete rewrite
- `docs/changelog.md` - New file

### Testing Notes
- Test on YouTube watch pages (URLs with `/watch?v=`)
- Verify no console errors during overlay lifecycle
- Confirm SPA navigation preserves overlay state
- Check dark mode and responsive behavior
