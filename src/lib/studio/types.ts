export type { Locale } from "@/i18n";

export type NoteData = {
  /** MIDI note number (C4 = 60). */
  midi: number;
  /** Start time in seconds. */
  start: number;
  /** Duration in seconds. */
  duration: number;
  /** Velocity 0..1 for color intensity. */
  velocity: number;
  /** Whether it's a highlight accent (used for the demo progression). */
  accent?: boolean;
};

export type ProcessStage =
  | "idle"
  | "uploaded"
  | "processing"
  | "done";

/** Fallback BPM when nothing better is known (mock / demo). */
export const DEFAULT_TEMPO = 120;

/**
 * Mock = MainTheme with a touch of Nuvole Bianche
 * (160s at 120 BPM; used anywhere a demo track is needed).
 * See LICENSE_NOTES.md for attribution.
 */
export const DEMO_TRACK_URL =
  "https://upload.wikimedia.org/wikipedia/commons/4/49/MainTheme_with_a_touch_of_Nuvole_Bianche.ogg";

export const DEMO_TRACK = {
  name: "MainTheme (Demo)",
  kind: "sample" as const,
  src: DEMO_TRACK_URL,
};
