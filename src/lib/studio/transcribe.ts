"use client";

import type { NoteData } from "@/lib/studio/types";

/**
 * Client-side audio → MIDI transcription powered by Basic Pitch
 * (@spotify/basic-pitch, TensorFlow.js). All processing happens in the
 * browser — audio never leaves the device.
 *
 * The model is served from `/model/basic-pitch/model.json` (copied into
 * `public/` at build time) so it loads from the same origin as the app.
 */

// Basic Pitch constants (mirrors the library internals).
const SAMPLE_RATE = 22050;
const MODEL_URL = "/model/basic-pitch/model.json";

let audioCtx: AudioContext | null = null;
let basicPitchModule: typeof import("@spotify/basic-pitch") | null = null;
let basicPitchInstance: import("@spotify/basic-pitch").BasicPitch | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

/** Fetch an audio source and decode it into an AudioBuffer. */
export async function decodeSource(src: string): Promise<AudioBuffer> {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();

  // Wrap the ArrayBuffer in a new Uint8Array so we can clone() without
  // serializing a SharedArrayBuffer/Transferred buffer.
  return await new Promise<AudioBuffer>((resolve, reject) => {
    getAudioContext().decodeAudioData(
      arrayBuffer.slice(0),
      resolve,
      (err) => reject(new Error(`Audio decoding failed: ${String(err)}`)),
    );
  });
}

/**
 * Down-mix to mono and resample to the model's sample rate using linear
 * interpolation (accurate enough for the 2.5x down-sample the model needs).
 */
export function resampleToMono(
  buffer: AudioBuffer,
  targetRate: number,
): Float32Array {
  const srcRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;

  if (numChannels === 1 && srcRate === targetRate) {
    return buffer.getChannelData(0);
  }

  const length = buffer.length;
  const ratio = srcRate / targetRate;
  const newLength = Math.max(1, Math.floor(length / ratio));
  const out = new Float32Array(newLength);

  // Fast path: already mono, just resample.
  if (numChannels === 1) {
    const src = buffer.getChannelData(0);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, length - 1);
      const frac = pos - i0;
      out[i] = src[i0]! * (1 - frac) + src[i1]! * frac;
    }
    return out;
  }

  // General path: down-mix + resample in one pass for performance.
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, length - 1);
    const frac = pos - i0;
    let acc = 0;
    for (let c = 0; c < numChannels; c++) {
      acc += channels[c]![i0]! * (1 - frac) + channels[c]![i1]! * frac;
    }
    out[i] = acc / numChannels;
  }
  return out;
}

async function getBasicPitch() {
  if (!basicPitchModule) {
    basicPitchModule = await import("@spotify/basic-pitch");
  }
  if (!basicPitchInstance) {
    basicPitchInstance = new basicPitchModule.BasicPitch(MODEL_URL);
  }
  return { module: basicPitchModule, instance: basicPitchInstance };
}

export type TranscriptionProgress = {
  /** 0..1 fraction through the model passes. */
  fraction: number;
  /** Human-readable stage label. */
  stage: string;
};

/** Compute the sample index where the last non-negligible energy occurs. */
function computeEndSeconds(samples: Float32Array): number {
  const block = Math.floor(samples.length * 0.001); // avg over ~0.1%
  const bin = block === 0 ? 1 : block;
  let lastSignificant = 0;
  for (let i = 0; i < samples.length; i += bin) {
    let sum = 0;
    const end = Math.min(i + bin, samples.length);
    for (let j = i; j < end; j++) {
      const v = samples[j]!;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (end - i));
    if (rms > 1e-3) lastSignificant = end;
  }
  return lastSignificant / SAMPLE_RATE;
}

/** Naive but robust tempo estimation from median inter-onset interval. */
function inferTempo(notes: NoteData[]): { tempo: number } {
  if (notes.length < 4) return { tempo: 120 };

  const starts = notes.map((n) => n.start).sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const dt = starts[i]! - starts[i - 1]!;
    if (dt > 0.08 && dt < 2.0) intervals.push(dt);
  }

  if (intervals.length < 3) return { tempo: 120 };
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)]!;
  if (median <= 0) return { tempo: 120 };
  const guess = 60 / median;
  return { tempo: Math.min(180, Math.max(60, Math.round(guess / 5) * 5)) };
}

/**
 * Run the full transcription pipeline and return studio-ready notes.
 */
export async function transcribeToNotes(
  src: string,
  onProgress?: (p: TranscriptionProgress) => void,
): Promise<{ notes: NoteData[]; tempo: number; durationSeconds: number }> {
  // 1. Decode
  onProgress?.({ fraction: 0, stage: "decode" });
  const buffer = await decodeSource(src);

  // 2. Preprocess (mono + resample)
  onProgress?.({ fraction: 0.02, stage: "preprocess" });
  const mono = resampleToMono(buffer, SAMPLE_RATE);
  const effEnd = computeEndSeconds(mono);
  const actual = Math.min(buffer.duration, effEnd);

  // Short clips need no model pass — return empty result.
  if (actual < 0.4 || mono.length < SAMPLE_RATE * 0.4) {
    return { notes: [], tempo: 120, durationSeconds: buffer.duration };
  }

  const { module, instance } = await getBasicPitch();
  onProgress?.({ fraction: 0.05, stage: "model" });

  // 3. Model inference (frames / onsets / contours), chunked by the library.
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await instance.evaluateModel(
    mono as unknown as AudioBuffer,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => {
      // Map model progress (0..1) into 0.05..0.7 of the overall bar.
      onProgress?.({ fraction: 0.05 + p * 0.65, stage: "model" });
    },
  );

  // 4. Convert model output → note events → time-based notes.
  onProgress?.({ fraction: 0.72, stage: "convert" });
  const notesInTime: { startTimeSeconds: number; durationSeconds: number; pitch_midi: number; amplitude: number; pitchBends?: number[] }[] = [];
  if (frames.length > 0) {
    const events = module.outputToNotesPoly(frames, onsets, 0.25, 0.25, 5);
    const withBends = module.addPitchBendsToNoteEvents(contours, events);
    for (const time of module.noteFramesToTime(withBends)) {
      notesInTime.push({
        startTimeSeconds: time.startTimeSeconds,
        durationSeconds: time.durationSeconds,
        pitch_midi: time.pitchMidi,
        amplitude: time.amplitude,
        pitchBends: time.pitchBends,
      });
    }
  }

  // 5. Map to studio NoteData + infer tempo.
  onProgress?.({ fraction: 0.9, stage: "tempo" });
  const notes: NoteData[] = notesInTime
    .map((n) => ({
      midi: n.pitch_midi,
      start: n.startTimeSeconds,
      duration: n.durationSeconds,
      velocity: Math.min(1, Math.max(0.25, n.amplitude)),
    }))
    .filter((n) => n.duration > 0.04)
    .sort((a, b) => a.start - b.start);

  const { tempo } = inferTempo(notes);
  const durationSeconds = buffer.duration;

  onProgress?.({ fraction: 1, stage: "done" });
  return { notes, tempo, durationSeconds };
}

/* ------------------------------------------------------------------ */
/* MIDI export                                                         */
/* ------------------------------------------------------------------ */

/**
 * Serialize notes + tempo into a downloadable Standard MIDI file using
 * @tonejs/midi (already a dependency of @spotify/basic-pitch).
 */
export async function exportMidi(
  notes: NoteData[],
  options: { tempo?: number; name?: string } = {},
): Promise<Uint8Array> {
  const { Midi } = await import("@tonejs/midi");
  const midi = new Midi();

  midi.header.name = options.name ?? "PianoMind AI transcription";
  midi.header.tempos = [{ ticks: 0, bpm: options.tempo ?? 120 }];

  const track = midi.addTrack();
  for (const n of notes) {
    track.addNote({
      midi: n.midi,
      time: n.start,
      duration: Math.max(0.05, n.duration),
      velocity: Math.round(Math.min(1, Math.max(0, n.velocity)) * 127),
    });
  }

  return midi.toArray();
}

/** Convenience: download a Uint8Array as a file. */
export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime = "application/octet-stream",
) {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
