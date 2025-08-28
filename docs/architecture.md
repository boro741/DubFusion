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

**Data Flow**: Options UI → JSON Validation → chrome.storage.local → ManualTranscriptProvider → Debug Overlay

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
