# DubFusion Architecture

## Overview
DubFusion is a Chrome extension that provides time-aligned YouTube dubbing using predictive caption look-ahead, batching, rewriting, and text-to-speech synthesis.

## Core Architecture

### Content Script Layer
The content script (`extension/src/content/content-script.js`) is injected into YouTube pages and serves as the primary interface for user interaction and caption processing.

### CaptionProvider Module
The CaptionProvider is a unified interface for accessing YouTube captions with three strategies:

- **ManualTranscriptProvider (S2M)**: Handles pre-built JSON transcripts stored per video ID. Transcripts are validated and stored in chrome.storage.local under `dfManualTranscripts[videoId]`. This provider offers the highest quality and most reliable caption data for testing and production use.

- **TextTrackStrategy (Auto Mode)**: Uses WebVTT cues from HTML5 video textTracks for true look-ahead capabilities. Automatically selects the first available subtitles/captions track and sets it to 'hidden' mode to access cues without rendering. This strategy provides access to future captions, enabling predictive processing.

- **DomPollingStrategy (Fallback)**: When TextTracks aren't accessible (e.g., DRM content, no captions available), falls back to polling the YouTube caption container DOM every 100ms. Creates synthetic cues from visible text changes, maintaining a 300-entry buffer with automatic cleanup of old entries.

The CaptionProvider automatically handles SPA navigation, reinitializing for new video elements and properly disposing of resources to prevent memory leaks.

### Manual Transcript Mode (S2M)
The Manual Transcript Mode allows users to paste pre-built JSON transcripts into the options page for specific YouTube videos. The system validates the transcript format, stores it per video ID, and provides it through the ManualTranscriptProvider. This mode is particularly useful for testing with high-quality, pre-processed transcripts and for videos where automatic caption detection is unreliable.

**Data Flow**: Options UI → JSON Validation → chrome.storage.local → ManualTranscriptProvider → Scheduler → Browser TTS → Debug Overlay

### Scheduler (Browser TTS + Mute) (S3M)
The Scheduler is responsible for timing and playing back manual transcript cues using the Web Speech API. It implements precise timing rules with early/late/skip logic and manages video muting during TTS playback. The scheduler operates on a 200ms planning loop, scheduling upcoming cues and managing their playback states.

**Key Features**:
- **Timing Rules**: Early start tolerance (-80ms), late skip threshold (+1.0s)
- **State Management**: Tracks cue states from NEW to PLAYED/SKIPPED/CANCELED
- **Mute Management**: Counter-based video muting with state restoration
- **Event Resilience**: Handles seek, pause, and rate changes with proper cleanup
- **Voice Selection**: Automatic English voice selection with fallback

**Data Flow**: ManualTranscriptProvider → Batcher → Scheduler → SpeechSynthesisUtterance → Video Mute Control

### Batcher (S4M.1)
The Batcher module converts individual caption cues into optimal batches for processing. It implements configurable join rules to merge adjacent cues based on timing gaps, duration limits, and character constraints. The batcher provides a unified interface for both display (overlay toggle) and future processing pipelines.

**Key Features**:
- **Join Rules**: Configurable rules for merging adjacent cues (gap ≤ 400ms, duration ≤ 2.5s, chars ≤ 140)
- **Sort & Dedupe**: Automatic sorting by start time and deduplication by cue ID
- **Batch Structure**: Maintains timing information and references to original cues
- **Overlay Integration**: Toggle between CUES and BATCHES views in debug overlay

**Data Flow**: CaptionProvider → Batcher → Display/Processing

### ElevenLabs Integration (E0)
The ElevenLabs integration provides cloud-based text-to-speech capabilities with high-quality voices. The system includes secure API key management, voice selection, and test functionality through the options interface.

**Key Features**:
- **Secure Storage**: API keys stored in chrome.storage.local, never exposed to content scripts
- **Voice Management**: List and select from available ElevenLabs voices
- **Test Functionality**: Play test audio through offscreen WebAudio context
- **Settings UI**: Comprehensive configuration interface with sliders and controls
- **Error Handling**: Robust error mapping for API failures and network issues

**Data Flow**: Options UI → Background Service → ElevenLabs API → Offscreen Audio Playback

### Background Service Worker
The service worker (`extension/src/background.js`) handles cloud API calls, secrets management, and background processing tasks.

### Offscreen Document
The offscreen document (`extension/src/offscreen/`) provides WebAudio capabilities for advanced audio processing and cloud TTS integration.

## Debug Overlay (S1)
The Debug Overlay is a minimal, reusable UI component that provides real-time visibility into DubFusion's internal state. It consists of a docked "DF" chip in the top-right corner that expands into a detailed panel showing horizon information, ready state, and debug logs. The overlay is designed to be SPA-aware, handling YouTube's single-page navigation without creating duplicates or losing state. It serves as the foundation for future debugging and monitoring capabilities as the caption processing pipeline is implemented.

## File Structure
- `extension/src/content/` - Content scripts and styles for YouTube page injection
- `extension/src/background.js` - Service worker for background tasks
- `extension/src/offscreen/` - Offscreen document for audio processing
- `extension/src/ui/` - Popup and options page interfaces
- `docs/` - Project documentation and specifications
