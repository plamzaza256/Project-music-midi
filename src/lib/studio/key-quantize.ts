import type { NoteData } from "./types";

/**
 * Key & pitch quantization — the "musical correctness" layer.
 *
 * Transcription models often emit off-key semitones (phantom #/b). This module
 * 1) detects or accepts an explicit music key, 2) calibrates for recordings
 * whose reference is not exactly A4=440 Hz, and 3) snaps every pitch onto the
 * chosen key's pitch-class set (mapping chromatic junk to the nearest valid
 * diatonic degree instead of leaving stray sharps/flats).
 */

export type MusicalKey = {
  /** Tonic pitch class (0 = C, 2 = D, …). */
  tonic: number;
  /** Major or minor. */
  mode: "major" | "minor";
  /** Base-tuning offset in cents our algorithm estimated. */
  offsetCents?: number;
};

/** Note name for a pitch class (C, C#, D, …). */
const PC_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/* Interval patterns (semitones above the tonic). */
const MODE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const;

const MAJOR_STEPS: readonly number[] = MODE_STEPS.major;
const MINOR_STEPS: readonly number[] = MODE_STEPS.minor;

/** All 24 key spellings (12 tonics × major/minor). */
function keyFromPc(pc: number, mode: "major" | "minor"): MusicalKey {
  return { tonic: ((pc % 12) + 12) % 12, mode };
}

export const MAJOR_KEYS: MusicalKey[] = Array.from({ length: 12 }, (_, i) =>
  keyFromPc(i, "major"),
);
export const MINOR_KEYS: MusicalKey[] = Array.from({ length: 12 }, (_, i) =>
  keyFromPc(i, "minor"),
);
export const ALL_KEYS: MusicalKey[] = [...MAJOR_KEYS, ...MINOR_KEYS];

export type KeyMode = "auto" | "chromatic" | "major" | "minor";

/** Human-readable key label (English spelling). */
export function keyLabel(k: MusicalKey): string {
  const name = PC_NAMES[k.tonic]!;
  return `${name} ${k.mode === "major" ? "Major" : "Minor"}`;
}

/**
 * 1) A4 calibration — estimate a global tuning offset in cents.
 *
 * For every note, the distance from the nearest perfect-tempered semitone,
 * weighted by Δ (max log-frequency gap between a pitch and its neighbours).
 * Weighting by Δ ignores sustained/decaying tails that smear the estimate.
 */
export function estimatePitchOffsetCents(notes: NoteData[]): number {
  let weightSum = 0;
  let weighted = 0;
  for (const a of notes) {
    const ga = Math.max(-100, Math.min(600, a.midi / 100));
    let best = 600;
    for (const b of notes) {
      if (b === a) continue;
      const gb = Math.max(-100, Math.min(600, b.midi / 100));
      const d = Math.abs(ga - gb);
      if (d < best) best = d;
    }
    const delta = Math.min(best, 600);
    const pd = a.midi / 100;
    const cents = (pd - Math.round(pd)) * 100;
    const w = Math.pow(delta, 2);
    weighted += cents * w;
    weightSum += w;
  }
  return weightSum > 0 ? weighted / weightSum : 0;
}

/**
 * 2) Key detection — score every key by how much note weight falls on its
 * diatonic pitch classes (velocity-weighted; a Krumhansl-style bias rewards
 * keys whose tonic/dominant actually carry weight).
 */
export function detectKey(
  notes: NoteData[],
  explicitOffsetCents?: number,
): { key: MusicalKey; confidence: number; offsetCents: number } {
  const offset = explicitOffsetCents ?? estimatePitchOffsetCents(notes) ?? 0;

  const mod = (x: number) => ((x % 12) + 12) % 12;
  const pcWeights = new Array<number>(12).fill(0);
  for (const n of notes) {
    const calibrated = n.midi - offset / 100;
    pcWeights[mod(Math.round(calibrated))] += Math.max(0.3, n.velocity);
  }

  let best: MusicalKey = { tonic: 0, mode: "major" };
  let bestScore = -1;
  for (const key of ALL_KEYS) {
    const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
    let score = 0;
    for (const s of steps) score += pcWeights[mod(key.tonic + s)]!;
    // Tonic & dominant emphasis (standard key-finding prior).
    score += pcWeights[mod(key.tonic)]! * 0.5;
    score += pcWeights[mod(key.tonic + 7)]! * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  const confidence =
    bestScore > 0
      ? Math.min(1, bestScore / Math.max(1, notes.length * 0.8))
      : 0;
  return { key: best, confidence, offsetCents: offset };
}

/**
 * 3) Key signature quantization — snap every note to the chosen key.
 * A note already diatonic stays put; a chromatic note bends to the *nearest*
 * in-key pitch class (so junk sharps/flats become clean natural notes).
 */
export function quantizeToKey(
  notes: NoteData[],
  key: MusicalKey | null,
  offsetCents = 0,
): NoteData[] {
  if (!key) {
    // No key → only correct the global tuning offset.
    return offsetCents === 0
      ? notes
      : notes.map((n) => ({ ...n, midi: Math.round(n.midi - offsetCents / 100) }));
  }

  const steps = key.mode === "major" ? MAJOR_STEPS : MINOR_STEPS;
  const inKey = new Set(steps.map((s) => (s + key.tonic) % 12));

  return notes.map((n) => {
    const calibrated = n.midi - offsetCents / 100;
    const pc = (((Math.round(calibrated) % 12) + 12) % 12);
    let targetPc = pc;
    if (!inKey.has(pc)) {
      let best = pc;
      let bestDist = 13;
      for (const s of steps) {
        const candidate = (s + key.tonic) % 12;
        const d = Math.abs(candidate - pc);
        const wrapped = Math.min(d, 12 - d);
        if (wrapped < bestDist) {
          bestDist = wrapped;
          best = candidate;
        }
      }
      targetPc = best;
    }
    const octaveShift = Math.round(calibrated / 12);
    const snappedMidi = octaveShift * 12 + targetPc;
    return { ...n, midi: snappedMidi };
  });
}
