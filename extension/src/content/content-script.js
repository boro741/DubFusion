// DubFusion Debug Overlay - S2: CaptionProvider Implementation
// Provides a minimal, reusable debug overlay for YouTube pages with caption reading

(function init() {
  const TRY_MS = 100;
  let tries = 0;
  let currentUrl = '';
  let overlayRoot = null;
  let logger = null;
  let captionProvider = null;
  let currentVideo = null;
  let currentVideoId = null;
  let scheduler = null;
  let batcher = null;
  let overlayViewMode = 'BATCHES'; // Default to BATCHES view

  // CaptionProvider module - unified interface for caption access
  class CaptionProvider {
    constructor() {
      this.strategy = null;
      this.video = null;
      this.videoId = null;
      this.disposed = false;
    }

    async init(videoEl, videoId = null) {
      console.log('[DubFusion] CaptionProvider.init() called with video:', videoEl, 'videoId:', videoId);
      
      if (this.disposed) {
        console.log('[DubFusion] CaptionProvider is disposed, returning');
        return;
      }
      
      this.video = videoEl;
      this.videoId = videoId;
      this.disposed = false;
      
      // Check transcript mode setting
      try {
        const { dfTranscriptMode: mode = 'manual' } = await chrome.storage.local.get('dfTranscriptMode');
        console.log('[DubFusion] Transcript mode:', mode);
        
        if (mode === 'manual' && videoId) {
          // Try manual transcript first
          console.log('[DubFusion] Trying manual transcript mode');
          this.strategy = new ManualTranscriptProvider();
          await this.strategy.init(videoId);
          
          const sourceLabel = this.strategy.getSourceLabel();
          console.log('[DubFusion] ManualTranscriptProvider source label:', sourceLabel);
          
          if (sourceLabel === 'manual') {
            console.log('[DubFusion] Manual transcript available, using ManualTranscriptProvider');
            logger.log('CaptionProvider: initialized with Manual transcript');
            return;
          } else {
            console.log('[DubFusion] No manual transcript found, disposing manual provider');
            this.strategy.dispose();
            this.strategy = null;
          }
        } else {
          console.log('[DubFusion] Manual mode not selected or no videoId:', { mode, videoId });
        }
        
        // Fall back to auto mode (TextTracks or DOM)
        console.log('[DubFusion] Using auto mode (TextTracks or DOM)');
        if (this.canUseTextTracks()) {
          console.log('[DubFusion] TextTracks available, using TextTrackStrategy');
          this.strategy = new TextTrackStrategy(this.video);
          await this.strategy.init();
          logger.log('CaptionProvider: initialized with TextTracks');
        } else {
          console.log('[DubFusion] TextTracks not available, using DomPollingStrategy');
          this.strategy = new DomPollingStrategy(this.video);
          await this.strategy.init();
          logger.log('CaptionProvider: initialized with DOM polling');
        }
        
      } catch (error) {
        console.error('[DubFusion] Failed to initialize caption provider:', error);
        logger.log(`CaptionProvider: init failed - ${error.message}`);
      }
    }

    canUseTextTracks() {
      console.log('[DubFusion] CaptionProvider.canUseTextTracks() called');
      console.log('[DubFusion] Video element:', this.video);
      console.log('[DubFusion] Video textTracks:', this.video?.textTracks);
      
      if (!this.video || !this.video.textTracks) {
        console.log('[DubFusion] No video or textTracks available');
        return false;
      }
      
      console.log('[DubFusion] Checking', this.video.textTracks.length, 'text tracks');
      
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const track = this.video.textTracks[i];
        console.log(`[DubFusion] Track ${i}:`, {
          kind: track.kind,
          mode: track.mode,
          language: track.language,
          label: track.label,
          readyState: track.readyState,
          cues: track.cues ? track.cues.length : 'no cues'
        });
        
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          if (track.mode === 'showing' || track.mode === 'hidden') {
            console.log(`[DubFusion] Found suitable track ${i}: ${track.kind} in ${track.mode} mode`);
            return true;
          }
        }
      }
      
      console.log('[DubFusion] No suitable text tracks found');
      return false;
    }

    getSourceLabel() {
      return this.strategy ? this.strategy.getSourceLabel() : '—';
    }

    getCuesInWindow(t0, t1) {
      if (!this.strategy || this.disposed) return [];
      return this.strategy.getCuesInWindow(t0, t1);
    }

    dispose() {
      if (this.disposed) return;
      
      if (this.strategy) {
        this.strategy.dispose();
        this.strategy = null;
      }
      
      this.video = null;
      this.disposed = true;
      logger.log('CaptionProvider: disposed');
    }
  }

  // TextTrackStrategy - preferred method using WebVTT cues
  class TextTrackStrategy {
    constructor(video) {
      this.video = video;
      this.activeTrack = null;
      this.trackId = null;
      this.cueIndex = 0;
      this.trackChangeListener = null;
      this.loadedDataListener = null;
    }

    async init() {
      this.setupTrackChangeListener();
      this.setupLoadedDataListener();
      
      // Try to select track immediately if video is already loaded
      if (this.video.readyState >= 1) {
        this.selectBestTrack();
      }
    }

    selectBestTrack() {
      console.log('[DubFusion] TextTrackStrategy.selectBestTrack() called');
      console.log('[DubFusion] Video textTracks length:', this.video.textTracks.length);
      
      logger.log(`TextTrackStrategy: checking ${this.video.textTracks.length} tracks`);
      
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const track = this.video.textTracks[i];
        console.log(`[DubFusion] Track ${i} details:`, {
          kind: track.kind,
          mode: track.mode,
          language: track.language,
          label: track.label,
          readyState: track.readyState,
          cues: track.cues ? track.cues.length : 'no cues'
        });
        
        logger.log(`Track ${i}: kind=${track.kind}, mode=${track.mode}, language=${track.language}`);
        
        if ((track.kind === 'subtitles' || track.kind === 'captions') && 
            (track.mode === 'showing' || track.mode === 'hidden')) {
          
          this.activeTrack = track;
          this.trackId = `track_${i}`;
          this.cueIndex = 0;
          
          console.log(`[DubFusion] Selected track ${i}:`, {
            language: track.language || 'unknown',
            cueCount: track.cues ? track.cues.length : 0,
            trackId: this.trackId
          });
          
          logger.log(`TextTrackStrategy: selected track ${i} (${track.language || 'unknown'}) with ${track.cues ? track.cues.length : 0} cues`);
          return;
        }
      }
      
      this.activeTrack = null;
      this.trackId = null;
      console.log('[DubFusion] No suitable track found in selectBestTrack');
      logger.log('TextTrackStrategy: no suitable track found');
    }

    setupTrackChangeListener() {
      // Listen for track mode changes (user toggling captions)
      this.trackChangeListener = () => {
        logger.log('TextTrackStrategy: track change detected');
        this.selectBestTrack();
      };
      
      this.video.addEventListener('loadedmetadata', this.trackChangeListener);
      this.video.addEventListener('loadeddata', this.trackChangeListener);
    }

    setupLoadedDataListener() {
      // Listen for when video data is loaded and tracks become available
      this.loadedDataListener = () => {
        logger.log('TextTrackStrategy: loadeddata event, checking tracks');
        setTimeout(() => {
          this.selectBestTrack();
        }, 100); // Small delay to ensure tracks are loaded
      };
      
      this.video.addEventListener('loadeddata', this.loadedDataListener);
    }

    getSourceLabel() {
      return this.activeTrack ? 'TextTracks' : '—';
    }

    getCuesInWindow(t0, t1) {
      console.log(`[DubFusion] TextTrackStrategy.getCuesInWindow(${t0}, ${t1}) called`);
      
      if (!this.activeTrack) {
        console.log('[DubFusion] No active track available');
        logger.log('TextTrackStrategy: no active track');
        return [];
      }
      
      if (!this.activeTrack.cues) {
        console.log('[DubFusion] No cues available in active track');
        logger.log('TextTrackStrategy: no cues available');
        return [];
      }
      
      const cues = [];
      console.log(`[DubFusion] Checking ${this.activeTrack.cues.length} cues in window [${t0}, ${t1}]`);
      logger.log(`TextTrackStrategy: checking ${this.activeTrack.cues.length} cues in window [${t0}, ${t1}]`);
      
      for (let i = 0; i < this.activeTrack.cues.length; i++) {
        const cue = this.activeTrack.cues[i];
        const startSec = Number(cue.startTime);
        const endSec = Number(cue.endTime);
        
        console.log(`[DubFusion] Cue ${i}: start=${startSec}, end=${endSec}, text="${cue.text || cue.payload || ''}"`);
        
        // Only return cues that start in the window (not past cues)
        if (startSec >= t0 && startSec <= t1) {
          const text = this.sanitizeText(cue.text || cue.payload || '');
          if (text.trim()) {
            const cueObj = {
              id: `${this.trackId}:${i}`,
              startSec,
              endSec,
              text: text.trim()
            };
            cues.push(cueObj);
            console.log(`[DubFusion] Added cue:`, cueObj);
          }
        }
      }
      
      console.log(`[DubFusion] Found ${cues.length} cues in window`);
      logger.log(`TextTrackStrategy: found ${cues.length} cues in window`);
      return cues.sort((a, b) => a.startSec - b.startSec);
    }

    sanitizeText(text) {
      // Strip HTML tags and normalize whitespace
      return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
    }

    dispose() {
      if (this.trackChangeListener) {
        this.video.removeEventListener('loadedmetadata', this.trackChangeListener);
        this.video.removeEventListener('loadeddata', this.trackChangeListener);
        this.trackChangeListener = null;
      }
      
      if (this.loadedDataListener) {
        this.video.removeEventListener('loadeddata', this.loadedDataListener);
        this.loadedDataListener = null;
      }
      
      this.activeTrack = null;
      this.trackId = null;
    }
  }

  // ManualTranscriptProvider - for pre-built JSON transcripts
  class ManualTranscriptProvider {
    constructor() {
      this.cues = [];
      this.videoId = null;
      this.disposed = false;
    }

    async init(videoId) {
      console.log('[DubFusion] ManualTranscriptProvider.init() called with videoId:', videoId);
      
      if (this.disposed) return;
      
      this.videoId = videoId;
      
      try {
        // Get transcript from storage
        const { dfManualTranscripts: transcripts = {} } = await chrome.storage.local.get('dfManualTranscripts');
        console.log('[DubFusion] All stored transcripts:', Object.keys(transcripts));
        console.log('[DubFusion] Looking for videoId:', videoId);
        
        const transcript = transcripts[videoId];
        console.log('[DubFusion] Found transcript for videoId:', transcript ? 'yes' : 'no');
        
        if (transcript && Array.isArray(transcript)) {
          this.cues = transcript;
          console.log(`[DubFusion] Loaded ${this.cues.length} cues for video ${videoId}`);
          logger.log(`ManualTranscriptProvider: loaded ${this.cues.length} cues`);
        } else {
          console.log(`[DubFusion] No manual transcript found for video ${videoId}`);
          console.log('[DubFusion] Available videoIds:', Object.keys(transcripts));
          logger.log(`ManualTranscriptProvider: no transcript found for ${videoId}`);
          this.cues = [];
        }
      } catch (error) {
        console.error('[DubFusion] Failed to load manual transcript:', error);
        logger.log(`ManualTranscriptProvider: load failed - ${error.message}`);
        this.cues = [];
      }
    }

    getSourceLabel() {
      const label = this.cues.length > 0 ? 'manual' : '—';
      console.log(`[DubFusion] ManualTranscriptProvider.getSourceLabel(): ${label} (${this.cues.length} cues)`);
      return label;
    }

    getCuesInWindow(t0, t1) {
      console.log(`[DubFusion] ManualTranscriptProvider.getCuesInWindow(${t0}, ${t1}) called`);
      
      if (this.cues.length === 0) {
        console.log('[DubFusion] No cues available in manual transcript');
        return [];
      }
      
      // Binary search for cues that start in the window
      const cues = [];
      
      for (let i = 0; i < this.cues.length; i++) {
        const cue = this.cues[i];
        if (cue.startSec >= t0 && cue.startSec <= t1) {
          cues.push(cue);
        }
      }
      
      console.log(`[DubFusion] Found ${cues.length} cues in window [${t0}, ${t1}]`);
      return cues.sort((a, b) => a.startSec - b.startSec);
    }

    getSummary() {
      if (this.cues.length === 0) {
        return { count: 0, firstTime: 0, lastTime: 0 };
      }
      
      return {
        count: this.cues.length,
        firstTime: this.cues[0].startSec,
        lastTime: this.cues[this.cues.length - 1].endSec
      };
    }

    dispose() {
      this.cues = [];
      this.videoId = null;
      this.disposed = true;
      console.log('[DubFusion] ManualTranscriptProvider disposed');
      logger.log('ManualTranscriptProvider: disposed');
    }
  }

  // Scheduler - Browser TTS + mute functionality
  class Scheduler {
    constructor() {
      this.video = null;
      this.provider = null;
      this.ttsProvider = 'browser'; // Default to browser
      this.config = {
        leadTimeSec: 0.8,        // Much shorter horizon for faster response
        lateSkipThresholdSec: 1.0,
        earlyStartSlackMs: 20    // Very aggressive early start
      };
      this.state = {
        isRunning: false,
        planningInterval: null,
        pendingTimers: new Map(),
        itemStates: new Map(),
        duckCount: 0,
        prevMuted: false,
        playCount: 0,
        skipCount: 0,
        speechWarmed: false
      };
      this.synthesisJobs = new Map(); // For cloud TTS audio
      this.preferredVoice = null;
      this.voicesLoaded = false;
    }

    async init(videoEl, provider) {
      console.log('[DubFusion] Scheduler.init() called');
      
      this.video = videoEl;
      this.provider = provider;
      
      // Load config from storage
      try {
        const { dfSchedulerConfig: config, dfTtsProvider } = await chrome.storage.sync.get(['dfSchedulerConfig', 'dfTtsProvider']);
        if (config) {
          this.config = { ...this.config, ...config };
        }
        if (dfTtsProvider) {
          this.ttsProvider = dfTtsProvider;
        }
      } catch (error) {
        console.warn('[DubFusion] Failed to load scheduler config, using defaults:', error);
      }
      
      // Initialize speech synthesis for browser TTS
      if (this.ttsProvider === 'browser') {
        await this.initSpeechSynthesis();
      }
      
      // Set up video event listeners
      this.setupVideoListeners();
      
      console.log('[DubFusion] Scheduler initialized with config:', this.config);
    }

    async initSpeechSynthesis() {
      // Aggressive voice loading and initialization
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
          this.voicesLoaded = true;
          this.selectPreferredVoice();
          
          // Immediately pre-warm with the selected voice
          if (this.preferredVoice) {
            const warmupUtterance = new SpeechSynthesisUtterance('a');
            warmupUtterance.voice = this.preferredVoice;
            warmupUtterance.rate = 1.2;
            speechSynthesis.speak(warmupUtterance);
            this.state.speechWarmed = true;
            console.log('[DubFusion] Speech synthesis aggressively pre-warmed');
          }
        }
      };
      
      // Try immediately
      loadVoices();
      
      // Also listen for voices to load
      speechSynthesis.addEventListener('voiceschanged', loadVoices);
      
      // Force voices to load if needed
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.getVoices(); // This sometimes triggers loading
        setTimeout(loadVoices, 100);
      }
    }

    selectPreferredVoice() {
      const voices = speechSynthesis.getVoices();
      console.log('[DubFusion] Available voices:', voices.length);
      
      // Try to find a preferred voice (English, natural-sounding)
      this.preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Natural') || voice.name.includes('Premium') || voice.name.includes('Enhanced'))
      ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
      
      console.log('[DubFusion] Selected voice:', this.preferredVoice?.name || 'default');
    }

    setupVideoListeners() {
      this.video.addEventListener('seeked', () => this.handleSeek());
      this.video.addEventListener('pause', () => this.handlePause());
      this.video.addEventListener('play', () => this.handlePlay());
      this.video.addEventListener('ratechange', () => this.handleRateChange());
    }

    start() {
      if (this.state.isRunning) return;
      
      console.log('[DubFusion] Scheduler.start() called');
      this.state.isRunning = true;
      
      // Start planning loop - very fast cadence for minimal latency
      this.state.planningInterval = setInterval(() => {
        this.planningLoop();
      }, 50); // Very fast 50ms intervals for minimal delay
      
      logger.log('Scheduler: started');
    }

    stop() {
      if (!this.state.isRunning) return;
      
      console.log('[DubFusion] Scheduler.stop() called');
      this.state.isRunning = false;
      
      // Clear planning interval
      if (this.state.planningInterval) {
        clearInterval(this.state.planningInterval);
        this.state.planningInterval = null;
      }
      
      // Cancel all pending timers
      this.clearAllTimers();
      
      // Cancel any ongoing speech
      if (this.ttsProvider === 'browser') {
        speechSynthesis.cancel();
      }
      
      // Reset mute state
      this.resetMuteState();
      
      logger.log('Scheduler: stopped');
    }

    planningLoop() {
      if (!this.video || !this.provider) return;
      
      const now = this.video.currentTime;
      const horizon = now + this.config.leadTimeSec;
      
      // Get cues in the planning window
      const cues = this.provider.getCuesInWindow(now, horizon);
      
      for (const cue of cues) {
        if (!this.state.itemStates.has(cue.id)) {
          // If using cloud TTS, start synthesis now
          if (this.ttsProvider === 'elevenlabs' && !this.synthesisJobs.has(cue.id)) {
            this.startSynthesis(cue);
          }
        
          // Check if cue is already due (very aggressive immediate start)
          const delta = now - cue.startSec;
          if (delta >= -0.1 && delta <= this.config.lateSkipThresholdSec) {
            // Cue is due or slightly early - start immediately
            console.log(`[DubFusion] Immediate start for cue ${cue.id} (delta: ${delta.toFixed(3)}s)`);
            this.startPlayback(cue);
          } else {
            // Schedule for future
            this.scheduleItem(cue, now);
          }
        }
      }
    }

    startSynthesis(cue) {
      // Don't request synthesis for the same cue twice
      if (this.synthesisJobs.has(cue.id)) return;
      
      console.log(`[DubFusion] Starting synthesis for cue ${cue.id}: "${cue.text}"`);
      this.synthesisJobs.set(cue.id, { status: 'IN_FLIGHT' });
      
      // Send message to background script to synthesize
      // Background will play audio directly through offscreen
      chrome.runtime.sendMessage({
        action: 'DF_ELEVEN_SYNTHESIZE',
        text: cue.text
      }).then(response => {
        if (response.success) {
          console.log(`[DubFusion] Synthesis successful for cue ${cue.id}: ${response.message}`);
          this.synthesisJobs.set(cue.id, {
            status: 'PLAYED',  // Mark as already played since background handled it
          });
          
          // Since audio is already playing, we should mark the cue as PLAYING
          this.state.itemStates.set(cue.id, 'PLAYING');
          this.state.playCount++;
          
          // Start muting immediately
          this.startMute();
          
          // Estimate duration and end mute (this is not perfect)
          const estimatedDurationMs = (cue.endSec - cue.startSec) * 1000;
          setTimeout(() => {
            this.state.itemStates.set(cue.id, 'PLAYED');
            this.endMute();
          }, estimatedDurationMs);
          
        } else {
          console.error(`[DubFusion] Synthesis failed for cue ${cue.id}:`, response.error);
          this.synthesisJobs.set(cue.id, { status: 'FAILED', error: response.error });
        }
      }).catch(error => {
        console.error(`[DubFusion] Error sending synthesis message for cue ${cue.id}:`, error);
        this.synthesisJobs.set(cue.id, { status: 'FAILED', error: error.message });
      });
    }

    scheduleItem(cue, now) {
      const delta = now - cue.startSec;
      
      // Mark as scheduled
      this.state.itemStates.set(cue.id, 'SCHEDULED');
      
      // Much more aggressive compensation for TTS startup latency
      const ttsLatencyCompensation = 0.4; // 400ms compensation for TTS startup
      const adjustedStartTime = cue.startSec - ttsLatencyCompensation;
      const adjustedDelta = now - adjustedStartTime;
      
      if (adjustedDelta < -this.config.earlyStartSlackMs / 1000) {
        // Too early - set timer with compensation
        const delay = (adjustedStartTime - now) * 1000;
        const timer = setTimeout(() => {
          this.startPlayback(cue);
        }, delay);
        
        this.state.pendingTimers.set(cue.id, timer);
        console.log(`[DubFusion] Scheduled item ${cue.id} for ${delay}ms from now (with ${(ttsLatencyCompensation * 1000)}ms compensation)`);
        
      } else if (delta <= this.config.lateSkipThresholdSec) {
        // Within acceptable range - start immediately
        this.startPlayback(cue);
        
      } else {
        // Too late - skip
        this.state.itemStates.set(cue.id, 'SKIPPED');
        this.state.skipCount++;
        console.log(`[DubFusion] Skipped late item ${cue.id} (${delta.toFixed(2)}s late)`);
        logger.log(`late-skip +${(delta * 1000).toFixed(0)}ms`);
      }
    }

    startPlayback(cue) {
      if (!this.state.isRunning) return;
      
      console.log(`[DubFusion] Starting playback for item ${cue.id}: "${cue.text}"`);
      
      // Mark as playing
      this.state.itemStates.set(cue.id, 'PLAYING');
      this.state.playCount++;
      
      // Start muting immediately
      this.startMute();
      
      if (this.ttsProvider === 'browser') {
        this.playBrowserTTS(cue);
      } else if (this.ttsProvider === 'elevenlabs') {
        this.playElevenLabsTTS(cue);
      }
    }

    playBrowserTTS(cue) {
      // Create utterance with aggressive settings for fastest startup
      const utterance = new SpeechSynthesisUtterance(cue.text);
      utterance.voice = this.preferredVoice;
      utterance.rate = 1.2;      // Slightly faster speech
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Cancel any ongoing speech immediately for faster switching
      speechSynthesis.cancel();
      
      // Aggressive pre-warming for fastest startup
      if (!this.state.speechWarmed) {
        const warmupUtterance = new SpeechSynthesisUtterance('a');
        warmupUtterance.voice = this.preferredVoice;
        warmupUtterance.rate = 1.2;
        speechSynthesis.speak(warmupUtterance);
        this.state.speechWarmed = true;
        console.log('[DubFusion] Speech synthesis pre-warmed');
      }
      
      // Set up event handlers
      utterance.onend = () => {
        const actualLatency = (this.video.currentTime - cue.startSec) * 1000;
        console.log(`[DubFusion] Finished playback for item ${cue.id}, latency: ${actualLatency.toFixed(0)}ms`);
        this.state.itemStates.set(cue.id, 'PLAYED');
        this.endMute();
        logger.log(`speak @ +${actualLatency.toFixed(0)}ms`);
      };
      
      utterance.onerror = (event) => {
        console.error(`[DubFusion] TTS error for item ${cue.id}:`, event);
        this.state.itemStates.set(cue.id, 'ERROR');
        this.endMute();
      };
      
      // Start speaking
      speechSynthesis.speak(utterance);
    }

    playElevenLabsTTS(cue) {
      const job = this.synthesisJobs.get(cue.id);
      
      if (job && job.status === 'PLAYED') {
        // Audio was already played by the background script during synthesis
        console.log(`[DubFusion] Audio for cue ${cue.id} was already played during synthesis`);
        // The mute handling is already taken care of in startSynthesis
        
      } else if (job && job.status === 'IN_FLIGHT') {
        console.warn(`[DubFusion] Audio for cue ${cue.id} not ready, skipping`);
        this.state.itemStates.set(cue.id, 'SKIPPED');
        this.state.skipCount++;
        this.endMute();
      } else {
        console.error(`[DubFusion] No synthesis job found for cue ${cue.id}, trying to synthesize now`);
        // Try to synthesize now as a last resort
        this.startSynthesis(cue);
      }
    }

    startMute() {
      this.state.duckCount++;
      
      if (this.state.duckCount === 1) {
        // First mute - remember previous state
        this.state.prevMuted = this.video.muted;
        this.video.muted = true;
        console.log('[DubFusion] Muted video (was:', this.state.prevMuted, ')');
      }
    }

    endMute() {
      this.state.duckCount--;
      
      if (this.state.duckCount === 0) {
        // Last unmute - restore previous state
        this.video.muted = this.state.prevMuted;
        console.log('[DubFusion] Unmuted video (restored to:', this.state.prevMuted, ')');
      }
    }

    resetMuteState() {
      if (this.state.duckCount > 0) {
        this.video.muted = this.state.prevMuted;
        this.state.duckCount = 0;
        console.log('[DubFusion] Reset mute state to:', this.state.prevMuted);
      }
    }

    clearAllTimers() {
      for (const [id, timer] of this.state.pendingTimers) {
        clearTimeout(timer);
      }
      this.state.pendingTimers.clear();
    }

    handleSeek() {
      console.log('[DubFusion] Video seeked, clearing schedule');
      
      // Cancel all pending timers
      this.clearAllTimers();
      
      // Cancel ongoing speech
      if (this.ttsProvider === 'browser') {
        speechSynthesis.cancel();
      }
      
      // Mark playing items as canceled
      let canceledCount = 0;
      for (const [id, state] of this.state.itemStates) {
        if (state === 'PLAYING') {
          this.state.itemStates.set(id, 'CANCELED');
          canceledCount++;
        }
      }
      
      // Reset mute state
      this.resetMuteState();
      
      // Clear item states
      this.state.itemStates.clear();
      
      logger.log(`seek → cleared ${canceledCount}`);
    }

    handlePause() {
      console.log('[DubFusion] Video paused, canceling speech');
      
      // Cancel ongoing speech
      if (this.ttsProvider === 'browser') {
        speechSynthesis.cancel();
      }
      
      // Mark playing items as canceled
      let canceledCount = 0;
      for (const [id, state] of this.state.itemStates) {
        if (state === 'PLAYING') {
          this.state.itemStates.set(id, 'CANCELED');
          canceledCount++;
        }
      }
      
      // Reset mute state
      this.resetMuteState();
      
      logger.log(`pause → cancel ${canceledCount}`);
    }

    handlePlay() {
      console.log('[DubFusion] Video resumed');
      logger.log('resume');
    }

    handleRateChange() {
      console.log('[DubFusion] Playback rate changed, recomputing timers');
      
      // Clear existing timers and recompute
      this.clearAllTimers();
      this.state.itemStates.clear();
      this.synthesisJobs.clear(); // Clear synthesis jobs on rate change
    }

    onUrlChange(newVideoId) {
      console.log('[DubFusion] URL changed, stopping scheduler');
      this.stop();
      this.synthesisJobs.clear();
    }

    setConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      console.log('[DubFusion] Scheduler config updated:', this.config);
    }

    setTtsProvider(newProvider) {
      if (this.ttsProvider !== newProvider) {
        console.log(`[DubFusion] TTS provider changed from ${this.ttsProvider} to ${newProvider}`);
        this.ttsProvider = newProvider;
        // If we switch to browser TTS, we might need to re-init speech synthesis
        if (newProvider === 'browser') {
          this.initSpeechSynthesis();
        }
      }
    }

    getStats() {
      return {
        playCount: this.state.playCount,
        skipCount: this.state.skipCount,
        isRunning: this.state.isRunning
      };
    }

    dispose() {
      this.stop();
      this.video = null;
      this.provider = null;
      this.synthesisJobs.clear();
      console.log('[DubFusion] Scheduler disposed');
    }
  }

  // Batcher - converts Cues to Batches using join rules
  class Batcher {
    constructor() {
      this.config = {
        batchJoinGapMs: 400,
        batchMaxDurationSec: 2.5,
        batchMaxChars: 140
      };
    }

    buildBatches(cues) {
      if (!cues || cues.length === 0) {
        return [];
      }

      console.log(`[DubFusion] Batcher.buildBatches() called with ${cues.length} cues`);

      // Sort cues by start time and dedupe by id
      const sortedCues = this.sortAndDedupe(cues);
      
      if (sortedCues.length === 0) {
        return [];
      }

      const batches = [];
      let currentBatch = null;

      for (const cue of sortedCues) {
        if (currentBatch === null) {
          // Start new batch
          currentBatch = this.createBatchFromCue(cue);
        } else if (this.canJoinCueToBatch(cue, currentBatch)) {
          // Join cue to current batch
          this.joinCueToBatch(cue, currentBatch);
        } else {
          // Finalize current batch and start new one
          batches.push(currentBatch);
          currentBatch = this.createBatchFromCue(cue);
        }
      }

      // Add the last batch if it exists
      if (currentBatch) {
        batches.push(currentBatch);
      }

      console.log(`[DubFusion] Created ${batches.length} batches from ${cues.length} cues`);
      return batches;
    }

    sortAndDedupe(cues) {
      // Sort by start time
      const sorted = cues.sort((a, b) => a.startSec - b.startSec);
      
      // Dedupe by id
      const seen = new Set();
      return sorted.filter(cue => {
        if (seen.has(cue.id)) {
          return false;
        }
        seen.add(cue.id);
        return true;
      });
    }

    createBatchFromCue(cue) {
      return {
        startSec: cue.startSec,
        endSec: cue.endSec,
        text: cue.text,
        cueIds: [cue.id]
      };
    }

    canJoinCueToBatch(cue, batch) {
      const gap = cue.startSec - batch.endSec;
      const joinedDuration = cue.endSec - batch.startSec;
      const joinedChars = batch.text.length + ' '.length + cue.text.length;

      return gap <= (this.config.batchJoinGapMs / 1000) &&
             joinedDuration <= this.config.batchMaxDurationSec &&
             joinedChars <= this.config.batchMaxChars;
    }

    joinCueToBatch(cue, batch) {
      batch.endSec = cue.endSec;
      batch.text = batch.text + ' ' + cue.text;
      batch.cueIds.push(cue.id);
      
      console.log(`[DubFusion] Joined cue ${cue.id} to batch, new text: "${batch.text}"`);
    }

    setConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      console.log('[DubFusion] Batcher config updated:', this.config);
    }
  }

  // DomPollingStrategy - fallback when TextTracks aren't accessible
  class DomPollingStrategy {
    constructor(video) {
      this.video = video;
      this.pollInterval = null;
      this.syntheticCues = [];
      this.currentCue = null;
      this.cueCounter = 0;
      this.maxCues = 300; // Cap at 300 synthetic cues
      this.maxAgeSec = 60; // Remove cues older than 60 seconds
    }

    async init() {
      this.startPolling();
    }

    startPolling() {
      this.pollInterval = setInterval(() => {
        this.pollCaptions();
      }, 100);
    }

    pollCaptions() {
      const captionContainer = document.querySelector('.ytp-caption-window-container');
      if (!captionContainer) return;

      const segments = captionContainer.querySelectorAll('.ytp-caption-segment');
      const visibleText = Array.from(segments)
        .map(seg => seg.textContent || '')
        .join(' ')
        .trim();

      if (visibleText && visibleText !== (this.currentCue?.text || '')) {
        // Close current cue
        if (this.currentCue) {
          this.currentCue.endSec = this.video.currentTime;
          this.syntheticCues.push(this.currentCue);
        }

        // Open new cue
        this.currentCue = {
          id: `dom:${++this.cueCounter}`,
          startSec: this.video.currentTime,
          endSec: this.video.currentTime,
          text: visibleText
        };

        this.cleanupOldCues();
      }
    }

    cleanupOldCues() {
      const now = this.video.currentTime;
      this.syntheticCues = this.syntheticCues.filter(cue => 
        (now - cue.endSec) < this.maxAgeSec
      );

      // Cap total number of cues
      if (this.syntheticCues.length > this.maxCues) {
        this.syntheticCues = this.syntheticCues.slice(-this.maxCues);
      }
    }

    getSourceLabel() {
      return 'DOM';
    }

    getCuesInWindow(t0, t1) {
      const cues = [...this.syntheticCues];
      
      // Add current cue if it exists
      if (this.currentCue) {
        cues.push(this.currentCue);
      }

      // Filter by window and sort by start time
      return cues
        .filter(cue => cue.startSec >= t0 && cue.startSec <= t1)
        .sort((a, b) => a.startSec - b.startSec);
    }

    dispose() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
      this.syntheticCues = [];
      this.currentCue = null;
    }
  }

  // Logger class for managing debug messages
  class DebugLogger {
    constructor(logElement) {
      this.logElement = logElement;
      this.entries = [];
      this.maxEntries = 50;
      this.visibleEntries = 5;
    }

    log(message) {
      const timestamp = new Date().toLocaleTimeString();
      const entry = { timestamp, message };
      
      this.entries.push(entry);
      if (this.entries.length > this.maxEntries) {
        this.entries.shift();
      }
      
      this.render();
    }

    render() {
      const visibleEntries = this.entries.slice(-this.visibleEntries);
      this.logElement.innerHTML = visibleEntries
        .map(entry => `<div class="log-entry">[${entry.timestamp}] ${entry.message}</div>`)
        .join('');
    }
  }

  // Check if current page is a YouTube watch page
  function isWatchPage() {
    return window.location.pathname === '/watch' && 
           window.location.search.includes('v=');
  }

  // Find the current video element
  function findVideoElement() {
    return document.querySelector('video');
  }

  // Extract video ID from current URL
  function getVideoId() {
    const url = new URL(window.location.href);
    return url.searchParams.get('v');
  }

  // Initialize caption provider for current video
  async function initCaptionProvider() {
    console.log('[DubFusion] initCaptionProvider() called');
    
    const video = findVideoElement();
    const videoId = getVideoId();
    
    console.log('[DubFusion] Found video element:', video);
    console.log('[DubFusion] Video ID:', videoId);
    
    if (!video) {
      console.log('[DubFusion] No video element found');
      logger.log('CaptionProvider: no video element found');
      return;
    }

    if (!videoId) {
      console.log('[DubFusion] No video ID found in URL');
      logger.log('CaptionProvider: no video ID found');
      return;
    }

    // Check if video has changed
    if (video === currentVideo && videoId === currentVideoId) {
      console.log('[DubFusion] Video element and ID unchanged, skipping initialization');
      return;
    }

    console.log('[DubFusion] Video element or ID changed, initializing new provider');

    // Dispose old provider
    if (captionProvider) {
      console.log('[DubFusion] Disposing old caption provider');
      captionProvider.dispose();
    }

    // Create new provider
    captionProvider = new CaptionProvider();
    currentVideo = video;
    currentVideoId = videoId;
    
    try {
      console.log('[DubFusion] Starting caption provider initialization');
      logger.log('CaptionProvider: initializing for new video');
      await captionProvider.init(video, videoId);
      
      // Initialize batcher
      batcher = new Batcher();
      console.log('[DubFusion] Batcher initialized');
      
      // Initialize scheduler if we have a manual transcript
      if (captionProvider.getSourceLabel() === 'manual' || true) { // Temporarily enable for testing
        console.log('[DubFusion] Manual transcript detected, initializing scheduler');
        if (scheduler) scheduler.dispose();
        scheduler = new Scheduler();
        await scheduler.init(video, captionProvider);
        scheduler.start();
        logger.log('Scheduler: initialized and started');
      } else {
        // If not manual mode, dispose of any old scheduler
        if (scheduler) {
          scheduler.dispose();
          scheduler = null;
        }
      }
      
      await updateOverlayHeader();
      updateCuesSection();
      
      // Set up a retry mechanism for when tracks load later (only for auto mode)
      let retryCount = 0;
      const maxRetries = 10;
      const retryInterval = setInterval(async () => {
        if (retryCount >= maxRetries) {
          clearInterval(retryInterval);
          console.log('[DubFusion] Max retries reached for caption provider');
          logger.log('CaptionProvider: max retries reached');
          return;
        }
        
        retryCount++;
        console.log(`[DubFusion] Caption provider retry ${retryCount}/${maxRetries}`);
        logger.log(`CaptionProvider: retry ${retryCount}/${maxRetries}`);
        
        // Re-check if we can use TextTracks now
        if (captionProvider && captionProvider.canUseTextTracks()) {
          console.log('[DubFusion] TextTracks now available, reinitializing');
          logger.log('CaptionProvider: TextTracks now available, reinitializing');
          captionProvider.init(video, videoId);
          await updateOverlayHeader();
          updateCuesSection();
          clearInterval(retryInterval);
        }
      }, 1000); // Retry every second
      
    } catch (error) {
      console.error('[DubFusion] Caption provider init failed:', error);
      logger.log(`CaptionProvider: init failed - ${error.message}`);
    }
  }

  // Update overlay header with caption source, TTS provider, and scheduler stats
  async function updateOverlayHeader() {
    const header = document.querySelector('.df-header');
    if (!header) return;

    const source = captionProvider ? captionProvider.getSourceLabel() : '—';
    
    // Get TTS provider and update scheduler
    let ttsProviderLabel = '';
    let currentTtsProvider = 'browser';
    try {
      const { dfTtsProvider: provider } = await chrome.storage.sync.get('dfTtsProvider');
      if (provider) {
        currentTtsProvider = provider;
      }
      if (scheduler) {
        scheduler.setTtsProvider(currentTtsProvider);
      }
      if (currentTtsProvider !== 'browser') {
        ttsProviderLabel = ` • TTS: ${currentTtsProvider}`;
      }
    } catch (error) {
      console.warn('[DubFusion] Failed to get TTS provider:', error);
      if (scheduler) {
        scheduler.setTtsProvider('browser'); // Fallback on error
      }
    }
    
    // Get scheduler stats if available
    let schedulerStats = '';
    if (scheduler) {
      const stats = scheduler.getStats();
      schedulerStats = ` • play:${stats.playCount} skip:${stats.skipCount}`;
    }
    
    header.innerHTML = `DubFusion • v0 overlay • Source:${source} • Horizon:+0.0s • Ready:+0.0s${ttsProviderLabel}${schedulerStats}`;
  }

  // Update cues section with next 3 cues or batches
  function updateCuesSection() {
    console.log('[DubFusion] updateCuesSection() called, view mode:', overlayViewMode);
    
    const cuesSection = document.querySelector('.df-cues');
    if (!cuesSection) {
      console.log('[DubFusion] No cues section found in DOM');
      return;
    }

    if (!captionProvider) {
      console.log('[DubFusion] No caption provider available');
      const cuesContent = cuesSection.querySelector('.cues-content');
      if (cuesContent) {
        cuesContent.innerHTML = '<div class="cues-none">(none; enable CC)</div>';
      }
      return;
    }

    const source = captionProvider.getSourceLabel();
    const now = currentVideo ? currentVideo.currentTime : 0;
    console.log(`[DubFusion] Current video time: ${now}`);
    
    const windowCues = captionProvider.getCuesInWindow(now, now + 30); // Next 30 seconds
    console.log(`[DubFusion] Found ${windowCues.length} cues in window`);

    // Update toggle buttons to reflect current view mode
    const toggleBtns = cuesSection.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === overlayViewMode);
    });

    const cuesContent = cuesSection.querySelector('.cues-content');
    if (!cuesContent) {
      console.log('[DubFusion] No cues content found');
      return;
    }

    if (source === 'manual' && windowCues.length === 0) {
      // Manual mode but no transcript found
      console.log('[DubFusion] Manual source missing for this videoId');
      cuesContent.innerHTML = '<div class="cues-none">Manual source missing for this videoId</div>';
      return;
    }

    if (windowCues.length === 0) {
      console.log('[DubFusion] No cues to display');
      cuesContent.innerHTML = '<div class="cues-none">(none; enable CC)</div>';
      return;
    }

    if (overlayViewMode === 'BATCHES' && batcher) {
      // Show batches
      const batches = batcher.buildBatches(windowCues);
      const nextBatches = batches.slice(0, 3);
      
      console.log(`[DubFusion] Created ${batches.length} batches, showing ${nextBatches.length}`);
      logger.log(`updateCuesSection: created ${batches.length} batches, showing ${nextBatches.length}`);

      if (nextBatches.length === 0) {
        cuesContent.innerHTML = '<div class="cues-none">(no batches)</div>';
      } else {
        const batchesHtml = nextBatches.map(batch => 
          `<div class="cue-entry">[${batch.startSec.toFixed(1)}→${batch.endSec.toFixed(1)}] ${batch.text}</div>`
        ).join('');
        
        // Add summary for manual transcripts
        let summaryHtml = '';
        if (source === 'manual' && captionProvider.strategy && captionProvider.strategy.getSummary) {
          const summary = captionProvider.strategy.getSummary();
          if (summary.count > 0) {
            const firstTime = formatTime(summary.firstTime);
            const lastTime = formatTime(summary.lastTime);
            summaryHtml = `<div class="cues-summary">cues:${summary.count} batches:${batches.length} first:${firstTime} last:${lastTime}</div>`;
          }
        }
        
        cuesContent.innerHTML = `${batchesHtml}${summaryHtml}`;
      }
    } else {
      // Show individual cues
      const nextCues = windowCues.slice(0, 3);
      console.log(`[DubFusion] Showing ${nextCues.length} cues`);
      logger.log(`updateCuesSection: showing ${nextCues.length} cues`);

      const cuesHtml = nextCues.map(cue => 
        `<div class="cue-entry">[${cue.startSec.toFixed(1)}→${cue.endSec.toFixed(1)}] ${cue.text}</div>`
      ).join('');
      
      // Add summary for manual transcripts
      let summaryHtml = '';
      if (source === 'manual' && captionProvider.strategy && captionProvider.strategy.getSummary) {
        const summary = captionProvider.strategy.getSummary();
        if (summary.count > 0) {
          const firstTime = formatTime(summary.firstTime);
          const lastTime = formatTime(summary.lastTime);
          summaryHtml = `<div class="cues-summary">cues:${summary.count} first:${firstTime} last:${lastTime}</div>`;
        }
      }
      
      cuesContent.innerHTML = `${cuesHtml}${summaryHtml}`;
    }
  }

  // Format time as mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get or create the overlay root element
  function getOrCreateOverlayRoot() {
    if (overlayRoot && document.contains(overlayRoot)) {
      return overlayRoot;
    }

    // Remove any existing overlay
    const existing = document.getElementById('df-overlay-root');
    if (existing) {
      existing.remove();
    }

    overlayRoot = document.createElement('div');
    overlayRoot.id = 'df-overlay-root';
    document.body.appendChild(overlayRoot);
    
    return overlayRoot;
  }

  // Create the debug overlay UI
  function createDebugOverlay() {
    const root = getOrCreateOverlayRoot();
    
    // Create DF chip (collapsed state)
    const chip = document.createElement('div');
    chip.id = 'df-chip';
    chip.className = 'df-chip';
    chip.textContent = 'DF';
    chip.title = 'DubFusion Debug Overlay';
    
    // Create overlay panel (expanded state)
    const overlay = document.createElement('div');
    overlay.id = 'df-overlay';
    overlay.className = 'df-overlay';
    
    // Header section
    const header = document.createElement('div');
    header.className = 'df-header';
    header.innerHTML = 'DubFusion • v0 overlay • Source:— • Horizon:+0.0s • Ready:+0.0s';
    
    // Cues section with toggle
    const cuesSection = document.createElement('div');
    cuesSection.className = 'df-cues';
    
    // Create toggle header
    const cuesHeader = document.createElement('div');
    cuesHeader.className = 'cues-header';
    cuesHeader.innerHTML = `
      <span class="cues-label">CUES:</span>
      <span class="view-toggle">
        <span class="toggle-btn active" data-view="BATCHES">BATCHES</span> | 
        <span class="toggle-btn" data-view="CUES">CUES</span>
      </span>
    `;
    
    // Add click handlers for toggle
    cuesHeader.addEventListener('click', (e) => {
      if (e.target.classList.contains('toggle-btn')) {
        // Update active state
        cuesHeader.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update view mode
        overlayViewMode = e.target.dataset.view;
        updateCuesSection();
      }
    });
    
    cuesSection.appendChild(cuesHeader);
    
    // Add placeholder content
    const cuesContent = document.createElement('div');
    cuesContent.className = 'cues-content';
    cuesContent.innerHTML = '<div class="cues-none">(none; enable CC)</div>';
    cuesSection.appendChild(cuesContent);
    
    // Log section
    const logContainer = document.createElement('div');
    logContainer.className = 'df-log-container';
    const logArea = document.createElement('div');
    logArea.className = 'df-log-area';
    logContainer.appendChild(logArea);
    
    overlay.appendChild(header);
    overlay.appendChild(cuesSection);
    overlay.appendChild(logContainer);
    
    // Initialize logger
    logger = new DebugLogger(logArea);
    
    // Toggle functionality
    let isExpanded = sessionStorage.getItem('df-overlay-expanded') === 'true';
    
    function toggleOverlay() {
      isExpanded = !isExpanded;
      sessionStorage.setItem('df-overlay-expanded', isExpanded);
      
      if (isExpanded) {
        overlay.classList.add('df-expanded');
        logger.log('overlay show');
        // Update cues when showing
        updateCuesSection();
      } else {
        overlay.classList.remove('df-expanded');
        logger.log('overlay hide');
      }
    }
    
    chip.addEventListener('click', toggleOverlay);
    
    // Set initial state
    if (isExpanded) {
      overlay.classList.add('df-expanded');
    }
    
    // Add elements to root
    root.appendChild(chip);
    root.appendChild(overlay);
    
    logger.log('overlay init');
    
    return { chip, overlay, logger };
  }

  // Main injection logic
  function injectDebugOverlay() {
    if (!isWatchPage()) {
      return;
    }

    // Check if overlay already exists
    if (document.getElementById('df-overlay-root')) {
      return;
    }

    try {
      createDebugOverlay();
      // Initialize caption provider after overlay is created
      setTimeout(initCaptionProvider, 500);
    } catch (error) {
      console.warn('[DubFusion] Failed to create debug overlay:', error);
    }
  }

  // Handle SPA navigation
  function handleUrlChange() {
    const newUrl = window.location.href;
    
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      
      if (isWatchPage()) {
        // Ensure overlay exists on watch pages
        if (!document.getElementById('df-overlay-root')) {
          injectDebugOverlay();
        } else if (logger) {
          logger.log('url change -> ensure overlay');
          // Re-initialize caption provider for new video
          setTimeout(initCaptionProvider, 500);
        }
      } else {
        // Hide overlay on non-watch pages
        const existing = document.getElementById('df-overlay-root');
        if (existing) {
          existing.style.display = 'none';
        }
        // Dispose caption provider and scheduler
        if (scheduler) {
          scheduler.dispose();
          scheduler = null;
        }
        if (captionProvider) {
          captionProvider.dispose();
          captionProvider = null;
          currentVideo = null;
        }
      }
    }
  }

  // Initialize overlay
  function initOverlay() {
    if (isWatchPage()) {
      injectDebugOverlay();
    }
  }

  // Set up URL change detection
  function setupUrlMonitoring() {
    // Listen for YouTube navigation events
    document.addEventListener('yt-navigate-finish', handleUrlChange);
    
    // Fallback: poll for URL changes
    setInterval(handleUrlChange, 1000);
    
    // Initial check
    handleUrlChange();
  }

  // Set up periodic updates for cues and scheduler stats
  function setupCuesUpdates() {
    setInterval(async () => {
      if (captionProvider && currentVideo) {
        updateCuesSection();
        await updateOverlayHeader(); // Update scheduler stats and TTS provider
      }
    }, 250); // Update every 250ms
  }

  // Main initialization
  function start() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initOverlay, 500);
        setupUrlMonitoring();
        setupCuesUpdates();
      });
    } else {
      setTimeout(initOverlay, 500);
      setupUrlMonitoring();
      setupCuesUpdates();
    }
  }

  start();
})();
