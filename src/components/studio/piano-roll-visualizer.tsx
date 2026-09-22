"use client";

import { useMemo, useRef } from "react";
import { Music4 } from "lucide-react";

import {
  buildRows,
  layoutNotes,
  type Row,
} from "@/lib/studio/pianoroll-geometry";
import { isBlackKey, midiToName } from "@/lib/studio/notes";
import type { NoteData } from "@/lib/studio/types";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";

const BEAT_WIDTH = 28; // px per beat (fixed; container scrolls horizontally)

type Props = {
  notes: NoteData[];
  tempo: number;
  onSeek?: (seconds: number) => void;
  /** Optional real-time playhead position in seconds. */
  playheadTime?: number | null;
};

export function PianoRollVisualizer({
  notes,
  tempo,
  onSeek,
  playheadTime = null,
}: Props) {
  const { dict } = useLanguage();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const secPerBeat = tempo > 0 ? 60 / tempo : 0.5;

  const { minMidi, maxMidi, ranges } = useMemo(() => {
    if (notes.length === 0) {
      return { minMidi: 60, maxMidi: 91, ranges: [] as Array<[number, number]> };
    }
    let lo = 127;
    let hi = 0;
    for (const n of notes) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
    lo = Math.max(0, lo - 4);
    hi = Math.min(127, hi + 4);
    // Expand so we show a reasonably tall keyboard (≥ 15 rows).
    while (hi - lo < 14 && hi < 127 - 1) hi += 1;
    while (hi - lo < 14 && lo > 0) lo -= 1;
    // Pre-compute row ranges for black key shading.
    const ranges: Array<[number, number]> = [];
    let start = -1;
    for (let m = lo; m <= hi; m++) {
      const black = isBlackKey(m);
      if (black && start === -1) start = m;
      if (!black && start !== -1) {
        ranges.push([start, m - 1]);
        start = -1;
      }
    }
    if (start !== -1) ranges.push([start, hi]);
    return { minMidi: lo, maxMidi: hi, ranges };
  }, [notes]);

  const rows: Row[] = useMemo(
    () => buildRows(minMidi, maxMidi),
    [minMidi, maxMidi],
  );

  const { rects, width, totalBeats } = useMemo(
    () => layoutNotes(notes, rows, BEAT_WIDTH, tempo),
    [notes, rows, tempo],
  );

  const topMargin = 20;
  const height = topMargin + rows.length * 9 + 12;
  const headerH = 24;

  // Beat markers every 4 beats.
  const beatMarkers: number[] = [];
  for (let b = 0; b <= totalBeats; b += 4) beatMarkers.push(b);

  // Playhead x position (either real-time or static demo position).
  const playheadX = useMemo(() => {
    if (playheadTime !== null && playheadTime !== undefined) {
      return (playheadTime / secPerBeat) * BEAT_WIDTH;
    }
    return width * 0.18;
  }, [playheadTime, secPerBeat, width]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 26; // 26 = label gutter offset
    if (x < 0) return;
    const seconds = (x / BEAT_WIDTH) * secPerBeat;
    onSeek(Math.max(0, seconds));
  };

  if (notes.length === 0) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-border bg-card/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Music4 className="size-10" />
          <p className="text-sm">{dict.studio.pianoRoll.empty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-[#0e0e15]">
      {/* Sticky header: title + tempo */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dict.studio.pianoRoll.title}</span>
          <Badge variant="cyan" className="font-mono">
            {notes.length} {dict.studio.pianoRoll.notes}
          </Badge>
        </div>
        <Badge variant="violet" className="font-mono">
          {Math.round(tempo)} BPM
        </Badge>
      </div>

      <div
        ref={scrollRef}
        className="pianoroll-scroll overflow-x-auto overflow-y-hidden"
        style={{ maxHeight: 420 }}
        role="region"
        aria-label={dict.studio.viewer.pianoRoll}
      >
        <svg
          width={width}
          height={height}
          className="block cursor-crosshair"
          style={{ minWidth: width }}
          onClick={handleClick}
        >
          {/* Beat grid */}
          {beatMarkers.map((b) => (
            <line
              key={b}
              x1={b * BEAT_WIDTH}
              x2={b * BEAT_WIDTH}
              y1={headerH + topMargin}
              y2={height}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          {/* Black-key band shading */}
          {ranges.map(([s, e], i) => {
            const y0 = headerH + topMargin + (maxMidi - e) * 9;
            const h = (e - s + 1) * 9;
            return (
              <rect
                key={i}
                x={0}
                y={y0}
                width={width}
                height={h}
                fill="rgba(0,0,0,0.28)"
              />
            );
          })}

          {/* Row separators + labels */}
          {rows.map((row, i) => {
            const y = headerH + topMargin + i * 9;
            const black = row.isBlack;
            const isC = row.midi % 12 === 0;
            return (
              <g key={row.midi}>
                <line
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  stroke={black ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.05)"}
                  strokeWidth={1}
                />
                <text
                  x={4}
                  y={y + 7.5}
                  fontSize={8.5}
                  fill={isC ? "rgba(167,139,250,0.9)" : "rgba(148,163,184,0.55)"}
                  fontFamily="ui-monospace, monospace"
                >
                  {midiToName(row.midi)}
                </text>
              </g>
            );
          })}

          {/* Notes */}
          {rects.map((r, i) => (
            <g key={i}>
              <rect
                x={r.x + 26}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={2}
                fill={r.fill}
                stroke={r.below}
                strokeWidth={0.5}
              />
              {r.accent && (
                <rect
                  x={r.x + 26}
                  y={r.y}
                  width={Math.min(r.w, 3)}
                  height={r.h}
                  rx={1}
                  fill="#ffffff"
                  opacity={0.5}
                />
              )}
            </g>
          ))}

          {/* Playhead */}
          <line
            x1={playheadX}
            x2={playheadX}
            y1={headerH}
            y2={height}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1}
          />
          <circle cx={playheadX} cy={headerH + 5} r={3} fill="#ffffff" />
        </svg>
      </div>

      {/* Bottom keyboard strip */}
      <div className="sticky bottom-0 left-0 z-10 border-t border-border bg-[#0e0e15] px-0.5 py-0.5">
        <div className="flex" style={{ paddingLeft: 26 }}>
          {rows.map((row) => {
            const black = row.isBlack;
            const isC = row.midi % 12 === 0;
            return (
              <div
                key={row.midi}
                title={midiToName(row.midi)}
                className={
                  "relative h-3.5 flex-1 " +
                  (black
                    ? "bg-zinc-900 "
                    : "bg-gradient-to-b from-zinc-200 to-zinc-400 ") +
                  (isC ? "border-l border-violet-400/60 " : "")
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
