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
