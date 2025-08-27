# DubFusion Step 4: Local Rewrite Stub Implementation

## Overview
This implementation adds a local rewrite stub functionality to DubFusion that processes live caption chunks and transforms them with a simple prefix addition.

## Features Implemented

### 1. Rewrite Toggle Button
- **Text**: "✍ Rewrite (stub)" when OFF, "⏸ Rewrite" when ON
- **Color**: Purple (#6f42c1) when OFF, Red (#dc3545) when ON
- **Placement**: Next to existing "DubFusion (Hello)", "▶ Captions", and "⚙ Settings" buttons
- **State**: Local boolean (resets to OFF on page reload)

### 2. Rewrite Handler
- **Function**: `onRawChunk(chunk)` - processes raw caption chunks
- **Input**: `{ startSec, endSec, text }` from CaptionSniffer
- **Output**: Rewritten chunk object with structure:
  ```javascript
  {
    videoTimeStartSec: number,
    videoTimeEndSec: number,
    sourceText: string,
    rewrittenText: string, // "[Hinglish TBD] " + sourceText
    styleSnapshot: {
      mix: number,
      glossaryTerms: string[]
    }
  }
  ```

### 3. Debug Overlay Updates
- **Header**: Shows mix percentage and glossary terms
- **RAW Section**: Last 5 raw caption lines (existing functionality)
- **RW Section**: Last 5 rewritten lines with format:
  ```
  RW
  [0:12 → 0:14] [Hinglish TBD] original caption text
  ```
- **Waiting State**: Shows "Rewrite: waiting for captions…" when rewrite is ON but captions are OFF

### 4. Data Flow
1. CaptionSniffer detects caption changes
2. When a caption chunk is flushed, it calls `onRawChunk()`
3. If rewrite is enabled, the chunk is transformed and stored
4. Debug overlay is updated to show both RAW and RW sections

### 5. Memory Management
- Only keeps last 5 rewritten chunks in memory
- Uses `slice(-5)` to maintain bounded history
- No persistence - resets on page reload

## Technical Implementation

### Key Functions Added
- `onRawChunk(chunk)` - Main rewrite handler
- `updateDebugOverlay()` - Enhanced debug display
- `formatTime(sec)` - Time formatting utility

### Modified Functions
- `CaptionSniffer.flushCurrent()` - Now publishes to rewrite handler
- `CaptionSniffer.start()` / `stop()` - Updated to use new debug overlay
- `injectUI()` / `injectUIFallback()` - Added rewrite button

### State Variables
- `rewriteEnabled` - Boolean toggle state
- `rewrittenChunks` - Array of last 5 rewritten chunks

## Testing

### Manual Test Steps
1. Load extension in Chrome developer mode
2. Navigate to YouTube or test page
3. Click "▶ Captions" to start caption sniffing
4. Click "✍ Rewrite (stub)" to enable rewrite
5. Verify debug overlay shows both RAW and RW sections
6. Test with captions OFF - should show "waiting for captions…"

### Test File
- `test-rewrite.html` - Standalone test page for verification

## Acceptance Criteria Met

✅ **Button appears**: "✍ Rewrite (stub)" button visible next to existing controls  
✅ **Idle behavior**: Shows "Rewrite: waiting for captions…" when captions OFF  
✅ **Live flow**: Both RAW and RW sections display when both features are ON  
✅ **Chunk alignment**: RW time ranges match RAW ranges  
✅ **History bounds**: Only last 5 RW lines visible  
✅ **Toggle OFF**: Stops generating RW lines while RAW continues  
✅ **No errors**: Clean console output  

## Console Logging
- Rewrite toggle ON/OFF events logged
- Each rewritten chunk logged once (on flush, not on poll)
- No spam or excessive logging

## Out of Scope (Correctly Excluded)
- No network calls or LLM integration
- No TTS functionality
- No background/offscreen changes
- No persistence or caching
- No complex formatting beyond simple prefix

## Next Steps
This stub implementation provides the foundation for:
- Real LLM integration in Step 5
- TTS processing in future steps
- Enhanced rewrite logic and formatting
