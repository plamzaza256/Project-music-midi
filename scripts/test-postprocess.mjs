/**
 * Smoke test for the post-processing pipeline — exercises the SAME functions
 * the studio runs before setState. Run with Node's TS type-stripping:
 *
 *   node --experimental-strip-types scripts/test-postprocess.mjs
 */
import {
  postProcessNotes,
  estimateTempo,
  DEFAULT_POST_OPTIONS,
} from "../src/lib/studio/postprocess.ts";

function approx(a, b, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

let failures = 0;
function check(label, ok) {
  if (ok) console.log("  ✔ " + label);
  else {
    failures++;
    console.error("  ✘ FAILED: " + label);
  }
}

// ---------- 1. Thresholds / cleanup -----------------------------------
// Two clear notes at 120 BPM + junk: a 20ms micro-note, a quiet ghost
// (below minVelocity), an out-of-range bass (C0), and an ultra-high note (C8).
const raw = [
  { midi: 60, start: 0.5, duration: 0.5, velocity: 0.8 },
  { midi: 60, start: 0.52, duration: 0.02, velocity: 0.7 }, // micro (min dur garbage)
  { midi: 72, start: 1.0, duration: 0.5, velocity: 0.15 }, // ghost (too quiet)
  { midi: 12, start: 0.5, duration: 0.6, velocity: 0.9 }, // C0 (below C1)
  { midi: 108, start: 1.5, duration: 0.4, velocity: 0.8 }, // C8 (above C7)
  { midi: 64, start: 1.5, duration: 0.5, velocity: 0.7 },
];

const result = postProcessNotes(raw, DEFAULT_POST_OPTIONS, 120);

check("ignored micro-notes (short duration)", result.notes.every((n) => n.duration >= 0.08));
check("dropped quiet ghost notes", result.notes.every((n) => n.velocity >= 0.3));
check("dropped out-of-range pitches (kept C1..C7)", result.notes.every((n) => n.midi >= 24 && n.midi <= 96));
check("kept the clear notes (>= 2 left)", result.notes.length >= 2);
check("estimated tempo sensible (110..140)", result.tempo >= 110 && result.tempo <= 140);

// ---------- 2. Quantization -------------------------------------------
const single = postProcessNotes(
  [{ midi: 60, start: 0.51, duration: 0.26, velocity: 0.8 }],
  DEFAULT_POST_OPTIONS,
  120,
);
check("snapped start to 16th grid (0.51 -> 0.5)", approx(single.notes[0].start, 0.5));
check("snapped duration to 16th grid (0.26 -> 0.25)", approx(single.notes[0].duration, 0.25));

// ---------- 3. Merge same-pitch retriggers ----------------------------
const merged = postProcessNotes(
  [
    { midi: 60, start: 0.0, duration: 0.4, velocity: 0.6 },
    { midi: 60, start: 0.41, duration: 0.3, velocity: 0.7 }, // tiny gap -> merge
    { midi: 62, start: 1.0, duration: 0.4, velocity: 0.6 },
  ],
  DEFAULT_POST_OPTIONS,
  120,
);
check("merged same-pitch retrigger into one note", merged.notes.filter((n) => n.midi === 60).length === 1);

// ---------- 4. Tempo estimation ---------------------------------------
const t1 = estimateTempo(
  [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map((s) => ({ start: s })),
  100,
);
check("estimates ~120 BPM from 8ths", Math.abs(t1 - 120) <= 5);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
