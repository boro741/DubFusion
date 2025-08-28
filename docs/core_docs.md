DUBFUSION — CORE SPEC (LLM-FRIENDLY)

0) Purpose
	•	Goal: time-aligned YouTube dubbing using predictive caption look-ahead → batch → rewrite → pre-synthesize → schedule & duck.
	•	Primary mode v1: Caption-first + Browser TTS; cloud TTS/LLM can drop-in later.

⸻

1) Modules & responsibilities

ContentScript:
  - UI, DebugOverlay
  - CaptionProvider (TextTracks | DOM)
  - CaptionBuffer (rolling horizon)
  - Batcher (merge/split)
  - RewriteEngine (stub → LLM later)
  - SynthesisPlanner (lead-time, inflight caps)
  - Scheduler (timed playback, ducking)
  - (Browser TTS in v1)

ServiceWorker (Background):
  - (Cloud) LLM/TTS adapters, secrets, fetch

Offscreen (optional in v1):
  - WebAudio/audio surface parity for cloud TTS


⸻

2) Config (default constants, tunable)

{
  "preloadWindowSec": 6.0,          // horizon H
  "leadTimeSec": 2.0,               // lead-time L
  "batchJoinGapMs": 400,
  "batchMaxDurationSec": 2.5,
  "batchSplitThresholdSec": 3.5,
  "batchMaxChars": 140,
  "lateSkipThresholdSec": 1.0,
  "earlyStartSlackMs": 80,
  "maxInflightSynths": 1,           // Browser TTS: 1; Cloud: 2
  "readyHorizonCapClips": 10,
  "readyHorizonCapSeconds": 30,
  "shortDropLen": 3
}


⸻

3) Data contracts (strict)

type Cue = {
  id: string;          // stable within a track or synthetic
  startSec: number;    // video timeline seconds
  endSec: number;
  text: string;
};

type Batch = {
  startSec: number;
  endSec: number;
  text: string;
  cueIds: string[];
};

type RewrittenBatch = {
  startSec: number;
  endSec: number;
  text: string;        // final text to synthesize
  meta: { mix: number; glossary: string[] };
};

type TTSJob = {
  jobId: string;
  provider: "browser" | "openai" | "elevenlabs" | "azure" | "google";
  text: string;
  voiceHint?: string;
};

type TTSJobResult = {
  jobId: string;
  ok: boolean;
  mimeType?: string;
  arrayBufferBase64?: string; // or transferable ArrayBuffer
  error?: string;
};

type ScheduledClip = {
  jobId: string;
  startSec: number;
  endSec: number;
  mimeType: string;
  arrayBufferBase64: string; // or ArrayBuffer
};

Invariants
	•	0 <= startSec < endSec
	•	Batches must be monotonic (non-overlapping unless same start for split pieces).
	•	Rewritten text must fit (heuristically) within (endSec - startSec); if not, split upstream.

⸻

4) State machine (per batch/clip)

NEW → QUEUED → SYNTH_INFLIGHT → READY → SCHEDULED → PLAYED
                         │           │            ├→ SKIPPED (late)
                         │           └────────────└→ CANCELED (seek/pause/rate)
                         └→ FAILED (adapter error)

Allowed transitions only; log once per transition.

⸻

5) Algorithms (pseudocode, stepwise)

5.1 CaptionProvider (TextTracks preferred; DOM fallback)

init(video):
  tracks = video.textTracks
  if tracks contains kind in {"subtitles","captions"} with cues:
     strategy = TEXTTRACKS(track)
  else:
     strategy = DOM_POLLING()

getCuesInWindow(t0, t1):
  if strategy == TEXTTRACKS:
     return cues where start>=t0 && start<=t1 (map to Cue)
  else:
     // DOM_POLLING keeps internal currentCue; when visible text changes:
     //   close previous with end=currentTime, emit Cue
     //   open new with start=currentTime, text=new text
     return cues whose [start,end] intersects [t0,t1]

5.2 CaptionBuffer (rolling horizon)

every 250ms:
  now = video.currentTime
  H = now + preloadWindowSec
  windowCues = provider.getCuesInWindow(now, H)
  dedupe by (id,start,end,text); sort by start
  buffer.snapshot = { horizonEnd: H, cues: windowCues }
on video events (seeked/pause/play/ratechange):
  reset timers/pointers; refresh snapshot next tick

5.3 Batcher (merge/split rules)

function buildBatches(cues):
  batches = []
  cur = null
  for cue in cues:
    if cur is null: cur = cue->batch()
    else if joinable(cur, cue):
      cur = merge(cur, cue)
    else:
      batches.push(cur); cur = cue->batch()
  if cur: batches.push(cur)
  batches2 = []
  for b in batches:
    if duration(b) > batchSplitThresholdSec:
      batches2.extend(splitByPunctOrWhitespace(b, batchMaxDurationSec))
    else:
      batches2.push(b)
  return filter(batches2, text.trim.length >= shortDropLen)

function joinable(b, cue):
  gap = cue.startSec - b.endSec
  return gap <= (batchJoinGapMs/1000) &&
         (duration(b)+duration(cue)) <= batchMaxDurationSec &&
         (len(b.text)+len(cue.text)) <= batchMaxChars

5.4 RewriteEngine (v0 stub; v1 LLM later)

rewrite(batches, style):
  return batches.map(b => ({
    startSec: b.startSec,
    endSec: b.endSec,
    text: "[Hinglish TBD] " + b.text,
    meta: { mix: style.mix, glossary: style.glossary.slice(0, 10) }
  }))

(LLM version: same I/O; enforce timing by splitting long outputs.)

5.5 SynthesisPlanner (lead-time, caps)

plannerLoop every 200ms:
  now = video.currentTime
  for rb in rewrittenBatches in [now, now+preloadWindowSec]:
     if rb not in queue && (rb.startSec - now) >= leadTimeSec:
        if inflight < maxInflightSynths && readyHorizonNotExceeded():
           enqueueSynth(rb)

enqueueSynth(rb):
  mark rb → QUEUED
  inflight++
  synth(rb) async:
    try:
      res = provider.synthesize(rb.text, voiceHint)
      mark rb → READY with audio res
    catch err:
      mark rb → FAILED
    finally:
      inflight--

readyHorizonNotExceeded():
  return sum(duration(READY clips with start>now)) < readyHorizonCapSeconds
         && READY_clip_count < readyHorizonCapClips

Browser TTS note (v1): synthesize() can be a no-op, and we call speechSynthesis.speak() in Scheduler at start time; or we can “prewarm” voices. For cloud TTS, synthesize() returns audio bytes.

5.6 Scheduler (timed playback, ducking, resilience)

onReady(clip):
  scheduleStart(clip)

scheduleStart(clip):
  now = video.currentTime
  Δ = now - clip.startSec
  if Δ < -earlyStartSlackMs/1000:
     setTimeout(startPlayback(clip), msUntil(clip.startSec))
  else if Δ <= lateSkipThresholdSec:
     startPlayback(clip)   // slightly late, play now
  else:
     mark SKIPPED (late)

startPlayback(clip):
  duckStart(clip.startSec, clip.endSec)
  if provider == "browser":
     speakBrowserTTS(clip.text, preferredVoice)
  else:
     offscreen.play(clip.mimeType, clip.arrayBuffer)
  on end → duckStop()

Resilience:
- on seeked: cancel all start timers; drop QUEUED/READY outside new window.
- on pause: pause scheduling new starts; on play: recompute timers with currentTime.
- on ratechange: recompute delays for not-yet-started clips.

Ducking (guarded counters):
	•	Maintain duckCount. duckStart increments; duckStop decrements; only when it reaches 0, restore volume.

⸻

6) Telemetry (for control loops & debugging)
	•	Overlay header (update ~500 ms):
Source:<TextTracks|DOM> • Horizon:+<H>s • Ready:+<readySec>s | jobs q:<n> i:<n> rdy:<n> play:<n> skip:<n>
	•	Events (one-liners, auto-clear):
synth start @ +<lead>s, late-skip +<sec>, seek → cleared <N>
	•	Latency tracking (optional adaptive): track p50 LLM, p50 TTS; recompute leadTimeSec = clamp(p50sum + padding).

⸻

7) ASCII diagrams

7.1 Architecture

[YouTube <video>]
      │ captions
      ▼
[CaptionProvider] --(Cues)--> [CaptionBuffer (H=+6s)]
      ▼                               │
     (DOM)                            ▼
                              [Batcher] --(Batches)--> [RewriteEngine]
                                                           │
                                                           ▼
                                                  [SynthesisPlanner (L=2s)]
                                                           │
                                                           ▼
                                                       [Scheduler]
                                             ┌───────────┴───────────┐
                                             ▼                       ▼
                                       duck original             play audio

7.2 Timing decision

Δ = now - startSec
if Δ < -0.08s → wait until startSec
else if Δ ≤ +1.0s → play now
else → skip (late)


⸻

8) Acceptance (assertions)
	•	A1: Horizon:+s ≥ preloadWindowSec - 0.5s during steady play.
	•	A2: Ready:+s ≥ leadTimeSec for ≥ 80% of time under normal network.
	•	A3: ≥ 90% of clips start within 0.8 s of startSec at 1.0× speed.
	•	A4: late-skip rate ≤ 10% on typical captioned videos.
	•	A5: seek/pause/ratechange produce no wrong-time audio; system restabilizes in ≤ 1 s.
	•	A6: no uncaught errors in consoles over ≥ 10 minutes.

⸻

9) Integration modes
	•	Mode A (v1): Browser TTS (Web Speech) — provider="browser", maxInflight=1, synth at startPlayback.
	•	Mode B: Cloud non-streaming TTS — synthesize() returns bytes; schedule as above; maxInflight=2.
	•	Mode C: Cloud streaming TTS — same contracts; lower leadTimeSec to ~0.8–1.0 s.

⸻

10) Security (for cloud modes)
	•	Secrets only in chrome.storage.local; background fetches; content script never sees keys.
	•	No secret logging. Redact PII in debug unless user opts in.

⸻
