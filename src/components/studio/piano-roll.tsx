"use client";

import type { CSSProperties } from "react";

/** Shared color lookups for piano-roll & processing overlay. */
export const COLORS = {
  /** Pitch classes that are black keys. */
  BLACK_KEYS: [1, 3, 6, 8, 10],
  /** Palette for notes, cycling by MIDI octave. */
  PALETTE: [
    "#22d3ee", // cyan
    "#8b5cf6", // violet
    "#a78bfa", // lighter violet
    "#e879f9", // fuchsia
    "#34d399", // emerald
    "#38bdf8", // sky
  ],
  /** Style for the keyboard labels / surface. */
  label: { color: "var(--muted-foreground)", fontSize: 10, fontFamily: "ui-monospace, monospace" } as CSSProperties,
} as const;

export function noteColor(midi: number): string {
  const idx = ((midi % 12) + 12) % 12;
  return COLORS.PALETTE[idx % COLORS.PALETTE.length]!;
}

/** Hex → rgba() string. */
export function shade(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Short color for a note (dim non-accent notes slightly). */
export function noteColorFor(n: { midi: number; accent?: boolean }): string {
  const base = noteColor(n.midi);
  return n.accent ? base : shade(base, 0.8);
}
