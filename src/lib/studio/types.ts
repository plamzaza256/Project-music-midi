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
export const DEFAULT_TEMPO = 100;

/**
 * Bundled demo track — a synthesized, public-domain "Ode to Joy" WAV that is
 * served from our own public/ directory. This guarantees the "Try sample
 * audio" button always plays, with no external hosts, CORS, or network
 * dependencies (important for sandboxed / proxied previews).
 */
export const DEMO_TRACK_URL = "/demo/pianomind-demo.wav";

export const DEMO_TRACK = {
  name: "Ode to Joy (Demo)",
  kind: "sample" as const,
  src: DEMO_TRACK_URL,
  durationSeconds: 19.6,
};
