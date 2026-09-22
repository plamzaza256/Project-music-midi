"use client";

import type { NoteData } from "@/lib/studio/types";
import {
  DEFAULT_POST_OPTIONS,
  postProcessNotes,
  midiToHz,
  type RawDetectedNote,
} from "@/lib/studio/postprocess";

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

/** Fetch an audio source (with a timeout) and decode it into an AudioBuffer. */
export async function decodeSource(
  src: string,
  timeoutMs = 30000,
): Promise<AudioBuffer> {
  let res: Response;
  try {
    res = await fetch(src);
  } catch {
    throw new Error(
      "decode: network unreachable — the browser could not fetch this source (CORS or offline).",
    );
  }
  if (!res.ok) {
    throw new Error(`decode: fetch returned HTTP ${res.status}`);
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await Promise.race([
      res.arrayBuffer(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("decode: fetch timed out")), timeoutMs),
      ),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("decode:")) throw e;
    throw new Error("decode: failed to read response body");
  }

  return decodeAudioBuffer(arrayBuffer);
}

/** Decode raw bytes into an AudioBuffer. */
export async function decodeAudioBuffer(
  arrayBuffer: ArrayBuffer,
): Promise<AudioBuffer> {
  // Wrap in a fresh Uint8Array so clone() doesn't touch a transferred buffer.
  return await new Promise<AudioBuffer>((resolve, reject) => {
    getAudioContext().decodeAudioData(
      arrayBuffer.slice(0),
      resolve,
      (err) =>
        reject(
          new Error(
            `decode: unsupported or corrupt audio (${String(err)})`,
          ),
        ),
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

  // Short clips need no model pass — return empty result.
  if (buffer.duration < 0.4 || mono.length < SAMPLE_RATE * 0.4) {
    return { notes: [], tempo: 100, durationSeconds: buffer.duration };
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
  onProgress?.({ fraction: 0.7, stage: "convert" });
  const rawNotes: RawDetectedNote[] = [];
  if (frames.length > 0) {
    // Tuned detection gate (reduces ghost notes):
    //   onsetThreshold 0.6  → keep only clear attacks
    //   frameThreshold 0.4  → trim background hum during onsets
    //   minNoteLen 5 frames  → coarse length gate (see postprocess too)
    const events = module.outputToNotesPoly(
      frames,
      onsets,
      DEFAULT_POST_OPTIONS.onsetThreshold,
      DEFAULT_POST_OPTIONS.frameThreshold,
      5, // minNoteLen (frames)
      true, // inferOnsets
      midiToHz(DEFAULT_POST_OPTIONS.maxMidi), // maxFreq (≈ C7)
      midiToHz(DEFAULT_POST_OPTIONS.minMidi), // minFreq (≈ C1)
      true, // melodiaTrick
    );
    const withBends = module.addPitchBendsToNoteEvents(contours, events);
    for (const time of module.noteFramesToTime(withBends)) {
      rawNotes.push({
        midi: time.pitchMidi,
        start: time.startTimeSeconds,
        duration: time.durationSeconds,
        velocity: time.amplitude,
      });
    }
  }

  // 5. Post-process: cleanup junk → estimate tempo → quantize.
  //    Hold the "refining note accuracy" stage for a visible moment while
  //    the fast post-processing math runs.
  onProgress?.({ fraction: 0.8, stage: "refine" });
  const [result] = await Promise.all([
    Promise.resolve(postProcessNotes(rawNotes, DEFAULT_POST_OPTIONS)),
    new Promise<void>((r) => setTimeout(r, 800)),
  ]);

  const durationSeconds = buffer.duration;

  onProgress?.({ fraction: 1, stage: "done" });
  return { notes: result.notes, tempo: result.tempo, durationSeconds };
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
