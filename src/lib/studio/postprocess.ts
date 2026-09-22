import type { NoteData } from "./types";
import {
  detectKey,
  estimatePitchOffsetCents,
  quantizeToKey,
  type KeyMode,
  type MusicalKey,
} from "./key-quantize.ts";

/**
 * Post-processing / cleanup for Basic Pitch output.
 *
 * The model emits raw note events that are often noisy: flaky micro-notes,
 * quiet ghost notes, subsonic/supersonic garbage, off-key sharps/flats, and
 * jittery timings. This module is the "audio-engineering" layer run BEFORE the
 * result reaches the Piano Roll — it tunes detection thresholds, filters junk,
 * detects the song key, snaps pitches to that key, estimates tempo, and
 * quantizes timings onto a musical grid.
 */

/** One raw note produced by Basic Pitch's `noteFramesToTime()`. */
export type RawDetectedNote = {
  /** MIDI note number. */
  midi: number;
  /** Start time in seconds. */
  start: number;
  /** Duration in seconds. */
  duration: number;
  /** Mean frame probability (0..1) — used as velocity. */
  velocity: number;
};

export type PostProcessOptions = {
  /** Detection gate for note onsets (passed to Basic Pitch). 0.5–0.7 keeps only clear attacks. */
  onsetThreshold: number;
  /** Sustained-frame gate during note tail (passed to Basic Pitch). 0.3–0.5 trims background hum. */
  frameThreshold: number;
  /** Drop notes shorter than this (seconds). 0.05–0.1 removes flaky micro-notes. */
  minDurationSec: number;
  /** Drop notes quieter than this mean frame amplitude. */
  minVelocity: number;
  /** Keep only notes within this MIDI range (inclusive). */
  minMidi: number;
  maxMidi: number;
  /** Snap note start/duration to a 16th-note grid. */
  quantize: boolean;
  /**
   * Key constraint for snapped pitch output — "auto" detects and snaps to the
   * detected key, "chromatic" leaves pitches as-is, "major"/"minor" snap to the
   * best key in that mode.
   */
  keyMode: KeyMode;
  /** Fixed key override (when the user picked one explicitly). */
  key: MusicalKey | null;
  /** Whether the A4=440 Hz calibration offset is estimated & applied. */
  calibrate: boolean;
};

/** C1 (MIDI 24) and C7 (MIDI 96) — the musically useful piano range. */
export const DEFAULT_POST_OPTIONS: PostProcessOptions = {
  onsetThreshold: 0.6,
  frameThreshold: 0.4,
  minDurationSec: 0.08, // 80 ms — inside the requested 50–100 ms band
  minVelocity: 0.25,
  minMidi: 24,
  maxMidi: 96,
  quantize: true,
  keyMode: "auto",
  key: null,
  calibrate: true,
};

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Estimate tempo by scoring each candidate BPM against the inter-onset
 * intervals (weighted by closeness; subdivision-normalized so bar-level gaps
 * don't double the tempo). A gentle prior favors the common 80–160 band.
 */
export function estimateTempo(
  notes: Array<{ start: number }>,
  fallback = 100,
): number {
  if (notes.length < 4) return fallback;

  const starts = notes.map((n) => n.start).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const dt = starts[i]! - starts[i - 1]!;
    if (dt > 0.08 && dt < 2.5) intervals.push(dt);
  }
  if (intervals.length < 3) return fallback;

  let best = fallback;
  let bestScore = -Infinity;

  for (let bpm = 58; bpm <= 204; bpm += 1) {
    const spb = 60 / bpm;
    let score = 0;
    for (const dt of intervals) {
      const q = dt / spb;
      const nearest = Math.max(1, Math.round(q));
      const err = Math.abs(q - nearest) / nearest;
      if (err < 0.18) score += (1 - err) / nearest;
    }
    if (bpm >= 80 && bpm <= 160) score += 0.3; // gentle prior
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }

  return Math.min(200, Math.max(58, Math.round(best / 5) * 5));
}

/** Merge same-pitch retriggers that are closer than ~60% of the min duration. */
function mergeSamePitch(
  notes: RawDetectedNote[],
  options: PostProcessOptions,
): RawDetectedNote[] {
  const sorted = [...notes].sort(
    (a, b) => a.start - b.start || a.midi - b.midi,
  );
  const out: RawDetectedNote[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.midi === n.midi &&
      n.start - (prev.start + prev.duration) < options.minDurationSec * 0.6
    ) {
      const end = Math.max(prev.start + prev.duration, n.start + n.duration);
      prev.duration = end - prev.start;
      prev.velocity = Math.max(prev.velocity, n.velocity);
    } else {
      out.push({ ...n });
    }
  }
  return out;
}

/** Snap start/duration to a 16th-note grid; re-merge same-pitch collisions. */
function quantizeNotes(
  notes: RawDetectedNote[],
  tempo: number,
): RawDetectedNote[] {
  const spb = 60 / tempo;
  const grid = Math.max(0, spb / 4); // 16th note

  const snapped = notes
    .map((n) => ({
      ...n,
      start: Math.round(n.start / grid) * grid,
      duration: Math.max(grid, Math.round(n.duration / grid) * grid),
    }))
    .sort((a, b) => a.start - b.start || a.midi - b.midi);

  const out: RawDetectedNote[] = [];
  for (const n of snapped) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.midi === n.midi &&
      n.start <= prev.start + prev.duration + grid * 0.5
    ) {
      const end = Math.max(prev.start + prev.duration, n.start + n.duration);
      prev.duration = Math.max(grid, end - prev.start);
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }
    out.push({ ...n });
  }
  return out;
}

/** Map model amplitude → display velocity (0.3..1.0). */
function normalizeVelocity(amplitude: number, minVelocity: number): number {
  const hi = 0.9;
  const t = Math.max(
    0,
    Math.min(1, (amplitude - minVelocity) / Math.max(hi - minVelocity, 1e-3)),
  );
  return 0.3 + t * 0.7;
}

export type PostProcessResult = {
  notes: NoteData[];
  tempo: number;
  key: MusicalKey | null;
  keyConfidence: number;
  offsetCents: number;
};

/**
 * Run the full cleanup pipeline over Basic Pitch's raw notes:
 * pitch range → min duration → velocity floor → duplicate merge → key detect →
 * A440 calibration → key snap → tempo → grid quantization → velocity normalize.
 */
export function postProcessNotes(
  raw: RawDetectedNote[],
  options: PostProcessOptions = DEFAULT_POST_OPTIONS,
  fallbackTempo = 100,
): PostProcessResult {
  // 1) Pitch range (C1..C7) + duration + velocity gates.
  const filtered = raw.filter((n) => {
    if (n.midi < options.minMidi || n.midi > options.maxMidi) return false;
    if (n.duration < options.minDurationSec) return false;
    if (n.velocity < options.minVelocity) return false;
    return true;
  });

  // 2) Merge flaky same-pitch retriggers.
  const merged = mergeSamePitch(filtered, options);
  const sorted = [...merged].sort(
    (a, b) => a.start - b.start || a.midi - b.midi,
  );

  // 3) Key detection + A440 calibration.
  let key: MusicalKey | null = null;
  let keyConfidence = 0;
  let offsetCents = 0;

  if (options.keyMode !== "chromatic") {
    if (options.key) {
      key = options.key;
      keyConfidence = 0.95;
      offsetCents = options.calibrate
        ? estimatePitchOffsetCents(sorted as NoteData[])
        : 0;
    } else {
      const detection = detectKey(
        sorted as NoteData[],
        options.calibrate ? undefined : 0,
      );
      key = detection.key;
      keyConfidence = detection.confidence;
      offsetCents = options.calibrate ? detection.offsetCents : 0;
      if (options.keyMode === "major" && key.mode !== "major") {
        key = { tonic: key.tonic, mode: "major" };
        keyConfidence *= 0.8;
      } else if (options.keyMode === "minor" && key.mode !== "minor") {
        key = { tonic: key.tonic, mode: "minor" };
        keyConfidence *= 0.8;
      }
    }
  }

  // 4) Snap pitches onto the key (mapping stray #/b to the nearest degree).
  const keyCleaned: NoteData[] = quantizeToKey(
    sorted as NoteData[],
    options.keyMode === "chromatic" ? null : key,
    offsetCents,
  );

  // 5) Tempo — estimated on cleaned (pre-quantization) timings.
  const tempo = options.quantize
    ? estimateTempo(keyCleaned, fallbackTempo)
    : fallbackTempo;

  // 6) Quantize timings onto the grid.
  const cleaned: NoteData[] = options.quantize
    ? quantizeNotes(keyCleaned as RawDetectedNote[], tempo)
    : keyCleaned;

  // 7) Normalize velocity.
  const notes: NoteData[] = cleaned.map((n) => ({
    midi: n.midi,
    start: n.start,
    duration: n.duration,
    velocity: normalizeVelocity(n.velocity, options.minVelocity),
  }));

  return { notes, tempo, key, keyConfidence, offsetCents };
}
