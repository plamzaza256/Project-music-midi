import { isBlackKey } from "@/lib/studio/notes";
import { noteColor, shade, COLORS } from "@/components/studio/piano-roll";
import type { NoteData } from "@/lib/studio/types";

export type Row = { midi: number; isBlack: boolean; top: number; h: number };
export type NoteRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  below: string;
  accent: boolean;
  midi: number;
};

const NOTE_HEIGHT = 9;

/** Build the list of visible keyboard rows (bottom → top). */
export function buildRows(minMidi: number, maxMidi: number): Row[] {
  const rows: Row[] = [];
  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const idx = maxMidi - midi;
    rows.push({
      midi,
      isBlack: isBlackKey(midi),
      top: idx * NOTE_HEIGHT,
      h: NOTE_HEIGHT,
    });
  }
  return rows;
}

/**
 * Compute each note's pixel position for the SVG scroll view.
 * - beatWidth (px per beat) is fixed; the container scrolls horizontally.
 * - topMargin compensates for the row label gutter.
 * - notes are given in seconds; `tempo` converts them to beats.
 */
export function layoutNotes(
  notes: NoteData[],
  rows: Row[],
  beatWidth: number,
  tempo: number,
  topMargin = 20,
) {
  const overscan = 16;
  const secPerBeat = 60 / tempo;
  const totalBeats =
    notes.reduce((m, n) => Math.max(m, (n.start + n.duration) / secPerBeat), 0) +
    4;
  const width = totalBeats * beatWidth + overscan;
  const minMidi = rows[rows.length - 1]!.midi;

  const rects: NoteRect[] = notes.map((n) => {
    const rgb = noteColor(n.midi);
    const rowIdx = Math.max(0, Math.min(rows.length - 1, n.midi - minMidi));
    const top = rowIdx * NOTE_HEIGHT;
    return {
      x: (n.start / secPerBeat) * beatWidth,
      y: topMargin + top + 1,
      w: Math.max((n.duration / secPerBeat) * beatWidth - 2.5, 4),
      h: NOTE_HEIGHT - 2,
      fill: n.accent ? rgb : shade(rgb, 0.82),
      below: shade(rgb, 0.38),
      accent: !!n.accent,
      midi: n.midi,
    };
  });

  return { rects, width, totalBeats };
}

export { COLORS, NOTE_HEIGHT };
