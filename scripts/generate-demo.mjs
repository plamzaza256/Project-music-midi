/**
 * Generate the bundled demo audio track: a clean, synthesized piano-style
 * rendition of "Ode to Joy" (public-domain melody) written out as a 16-bit
 * PCM WAV file into public/demo/. Bundling a local file guarantees the
 * "Try sample audio" button works in any environment (no external hosts,
 * no CORS, no network).
 *
 * Usage: node scripts/generate-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "demo", "pianomind-demo.wav");

const SR = 44100;
const BPM = 100;
const BEAT = 60 / BPM;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Ode to Joy, C major — [midi, startBeat, durationBeats, velocity]
// (16-beat phrase × 2 passes + closing chord)
const MELODY = [
  [64, 0, 1, 1.0], // E4
  [64, 1, 1, 0.9],
  [65, 2, 1, 0.9], // F4
  [67, 3, 1, 1.0], // G4
  [67, 4, 1, 1.0],
  [65, 5, 1, 0.9],
  [64, 6, 1, 0.9],
  [62, 7, 1, 0.85], // D4
  [60, 8, 1, 0.9], // C4
  [60, 9, 1, 0.85],
  [62, 10, 1, 0.85],
  [64, 11, 1, 0.9],
  [64, 12, 1, 0.85],
  [62, 13, 1, 0.8],
  [62, 14, 2, 0.85],
];

// Simple bass roots per 4-beat bar (C3 / G2).
const BASS = [48, 43, 48, 43];

const TOTAL_BEATS = 32;
const TAIL = 0.4;

function renderNote(out, midi, startBeat, durBeats, vel) {
  const f = midiHz(midi);
  const start = startBeat * BEAT;
  const dur = durBeats * BEAT;
  const i0 = Math.floor(start * SR);
  const ns = Math.min(Math.floor(dur * SR), out.length - i0);
  const attackSamples = Math.floor(0.008 * SR);

  for (let i = 0; i < ns && i0 + i < out.length; i++) {
    const t = i / SR;
    const attack = Math.min(1, i / attackSamples);
    const decay = Math.exp((-3.4 * t) / Math.max(0.2, dur));
    const env = attack * decay;
    const s =
      Math.sin(2 * Math.PI * f * t) +
      0.42 * Math.sin(2 * Math.PI * f * 2 * t) +
      0.16 * Math.sin(2 * Math.PI * f * 3 * t) +
      0.06 * Math.sin(2 * Math.PI * f * 4 * t);
    out[i0 + i] += s * env * vel;
  }
}

function build() {
  const totalSec = TOTAL_BEATS * BEAT + TAIL;
  const N = Math.floor(totalSec * SR);
  const out = new Float32Array(N);

  for (const pass of [0, 1]) {
    const off = pass * 16;
    for (const [m, s, d, v] of MELODY) renderNote(out, m, s + off, d, v);
    for (let bar = 0; bar < 4; bar++) {
      renderNote(out, BASS[bar % BASS.length], off + bar * 4, 3.8, 0.5);
    }
  }

  // Closing C-major chord on the last bar.
  for (const m of [48, 60, 64, 67]) renderNote(out, m, 28, 3.8, 0.42);

  // Normalize.
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.abs(out[i]);
    if (a > peak) peak = a;
  }
  const gain = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < N; i++) out[i] *= gain;

  // Gentle fade in/out to avoid clicks.
  const fade = Math.floor(0.02 * SR);
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[N - 1 - i] *= i / fade;
  }

  return out;
}

function writeWav(file, samples) {
  const dataSize = samples.length * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), o);
    o += 2;
  }
  fs.writeFileSync(file, buf);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const samples = build();
writeWav(OUT, samples);

const size = fs.statSync(OUT).size;
console.log(`✔ wrote ${OUT}`);
console.log(`  duration: ${(samples.length / SR).toFixed(2)}s`);
console.log(`  size: ${(size / 1024 / 1024).toFixed(2)} MB`);
