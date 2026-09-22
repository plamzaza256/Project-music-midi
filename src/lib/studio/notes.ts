import type { NoteData } from "@/lib/studio/types";

/** MIDI note number → note name with octave (e.g. 60 → "C4"). */
export function midiToName(midi: number): string {
  const names = [
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
  const octave = Math.floor(midi / 12) - 1;
  const name = names[((midi % 12) + 12) % 12]!;
  return `${name}${octave}`;
}

/** Returns true when the note is a black key (C#/D#/F#/G#/A#). */
export function isBlackKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic mock transcription (Phase 1/2 fallback for the demo track).
 * Produces notes whose `start`/`duration` are in **seconds** at `tempo` BPM.
 */
export function generateMockNotes(
  seed = 7,
  durationSeconds = 32,
  tempo = 120,
): NoteData[] {
  const rnd = mulberry32(seed);
  const chordProgression = [60, 64, 67, 65, 69, 72]; // C, E, G, F, A, C
  const secPerBeat = 60 / tempo;
  const totalBeats = Math.max(8, durationSeconds / secPerBeat);
  const bars = Math.max(8, Math.floor(totalBeats / 4));
  const notes: NoteData[] = [];
  const chordDur = totalBeats / bars / 2;
  const C4 = 48; // lowest row
  const TOP = 96; // C7

  let t = 0;
  while (t < totalBeats - 0.6) {
    const barIndex = Math.floor(t / 4) % chordProgression.length;
    const root = chordProgression[barIndex]!;
    const options = [root - 12, root, root + 4, root + 7, root + 12];
    const midi = options[Math.floor(rnd() * options.length)]!;
    const lo = options[Math.floor(rnd() * Math.min(2, options.length))]!;

    // right hand — melody-ish
    if (rnd() > 0.15) {
      notes.push({
        midi,
        start: t * secPerBeat,
        duration: Math.max(0.3, 0.6 - ((midi % 2) + 1) * 0.075),
        velocity: 0.55 + rnd() * 0.45,
        accent: t % 8 < 0.05,
      });
    }
    // left hand — bass on downbeats
    if (t % 4 < 0.05) {
      notes.push({
        midi: lo,
        start: t * secPerBeat,
        duration: Math.min(chordDur, 2) * secPerBeat,
        velocity: 0.7 + rnd() * 0.3,
        accent: true,
      });
    }
    t += 0.75 + rnd() * 0.9;
  }

  // Keep notes inside the visible keyboard range.
  return notes
    .map((n) => ({ ...n, midi: Math.min(TOP, Math.max(C4, n.midi)) }))
    .sort((a, b) => a.start - b.start);
}
