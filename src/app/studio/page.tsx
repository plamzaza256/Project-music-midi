"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AudioWaveform,
  Download,
  FileJson,
  FileMusic,
  Sparkles,
} from "lucide-react";
import * as React from "react";

import { Footer, Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  keyLabel,
  ALL_KEYS,
  type KeyMode,
  type MusicalKey,
} from "@/lib/studio/key-quantize";
import { UploadZone, validateFile, type TrackKind } from "@/components/studio/upload-zone";
import {
  WaveformPlayer,
  type WaveformPlayerHandle,
} from "@/components/studio/waveform-player";
import { PianoRollVisualizer } from "@/components/studio/piano-roll-visualizer";
import { SheetMusicPlaceholder } from "@/components/studio/sheet-music-placeholder";
import { ProcessingOverlay, type ProcessingInfo } from "@/components/studio/processing-overlay";
import {
  exportMidi,
  downloadBytes,
  transcribeToNotes,
} from "@/lib/studio/transcribe";
import { midiToName } from "@/lib/studio/notes";
import {
  DEMO_TRACK,
  DEFAULT_TEMPO,
  type ProcessStage,
  type NoteData,
} from "@/lib/studio/types";

const PROCESSING_MIN_MS = 2500;

type Track = {
  name: string;
  kind: TrackKind;
  src: string;
  objectUrl?: string;
  isVideo?: boolean;
};

/** Heuristically best-effort trim of a URL to a likely file name. */
function urlToName(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "";
    if (last) return decodeURIComponent(last).slice(0, 60);
    return u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}

function looksLikeAudioFile(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i.test(path);
  } catch {
    return false;
  }
}

function isYouTubeUrl(url: string): boolean {
  return /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/i.test(
    (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })(),
  );
}

function isUnsupportedPageUrl(url: string): boolean {
  return /(soundcloud\.com|spotify\.com|facebook\.com|instagram\.com|tiktok\.com)/i.test(
    url,
  );
}

function baseName(name: string): string {
  return name.replace(/\.\w+$/, "");
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/* ---- Small presentational bits ---------------------------------------- */

function EmptyState() {
  const { dict } = useLanguage();
  return (
    <div className="grid h-full min-h-[280px] place-items-center rounded-xl border border-dashed border-border bg-card/30">
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-cyan-300">
          <Sparkles className="size-6" />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {dict.studio.upload.processingHint}
        </p>
      </div>
    </div>
  );
}

/* ---- Page ------------------------------------------------------------- */

export default function StudioPage() {
  const { dict } = useLanguage();

  const [stage, setStage] = React.useState<ProcessStage>("idle");
  const [track, setTrack] = React.useState<Track | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<NoteData[]>([]);
  const [tempo, setTempo] = React.useState(DEFAULT_TEMPO);
  const [progress, setProgress] = React.useState<ProcessingInfo>({
    progress: 0,
    stageKey: "idle",
  });
  const [playheadTime, setPlayheadTime] = React.useState(0);
  const [detectedKey, setDetectedKey] = React.useState<MusicalKey | null>(null);
  const [keyMode, setKeyMode] = React.useState<KeyMode>("auto");
  const [selectedKey, setSelectedKey] = React.useState<MusicalKey | null>(null);

  const playerRef = React.useRef<WaveformPlayerHandle | null>(null);
  const resultRef = React.useRef<HTMLDivElement | null>(null);
  const seq = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);

  // ---- requestAnimationFrame: read WaveSurfer currentTime directly -------
  // (Solves playhead sync: rAF reads the audio clock every frame instead of
  // relying on the ~4 Hz React state from WaveSurfer's 'timeupdate' event.)
  React.useEffect(() => {
    let raf = 0;
    const loop = () => {
      const wsTime = playerRef.current?.getCurrentTime() ?? 0;
      setPlayheadTime((prev) =>
        Math.abs(prev - wsTime) > 0.001 ? wsTime : prev,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    rafRef.current = raf;
    return () => {
      cancelAnimationFrame(raf);
      rafRef.current = null;
    };
  }, []);

  // Clear any pending transcribe timer on unmount.
  React.useEffect(() => {
    return () => {
      seq.current += 1;
    };
  }, []);

  const clearSession = React.useCallback(() => {
    seq.current += 1;
    if (track?.objectUrl) URL.revokeObjectURL(track.objectUrl);
    setTrack(null);
    setNotes([]);
    setTempo(DEFAULT_TEMPO);
    setStage("idle");
    setError(null);
    setProgress({ progress: 0, stageKey: "idle" });
    setPlayheadTime(0);
    setDetectedKey(null);
  }, [track]);

  // ---- input handlers ---------------------------------------------------
  const handleFile = React.useCallback(
    (file: File) => {
      setError(null);
      const fileError = validateFile(file, dict);
      if (fileError) {
        setError(fileError);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith("video");
      setTrack({
        name: file.name,
        kind: "file",
        src: objectUrl,
        objectUrl,
        isVideo,
      });
      setNotes([]);
      setStage("uploaded");
      setTempo(DEFAULT_TEMPO);
    },
    [dict],
  );

  const handleUrl = React.useCallback(
    (rawUrl: string) => {
      setError(null);
      let url = rawUrl.trim();
      if (!url) return;

      // Normalize: allow missing scheme (adds https://).
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        setError(`${dict.studio.upload.badUrl}: ${rawUrl}`);
        return;
      }

      if (!/^https?:$/.test(parsed.protocol)) {
        setError(`${dict.studio.upload.badUrl}: ${rawUrl}`);
        return;
      }

      // YouTube → route through our own server proxy (bypasses CORS).
      if (isYouTubeUrl(parsed.href)) {
        setTrack({
          name: urlToName(parsed.href),
          kind: "url",
          src: `/api/yt-extract?url=${encodeURIComponent(parsed.href)}`,
        });
        setNotes([]);
        setStage("uploaded");
        setTempo(DEFAULT_TEMPO);
        return;
      }

      // Unsupported page platforms need a backend we don't have yet.
      if (isUnsupportedPageUrl(parsed.href)) {
        setError(dict.studio.upload.pageNotSupported);
        return;
      }

      if (!looksLikeAudioFile(parsed.href)) {
        setError(dict.studio.upload.notAudioWarning);
      }

      setTrack({
        name: urlToName(parsed.href),
        kind: "url",
        src: parsed.href,
      });
      setNotes([]);
      setStage("uploaded");
      setTempo(DEFAULT_TEMPO);
    },
    [dict],
  );

  const handleSample = React.useCallback(() => {
    setError(null);
    setTrack({ name: DEMO_TRACK.name, kind: "sample", src: DEMO_TRACK.src });
    setNotes([]);
    setStage("uploaded");
    setTempo(DEFAULT_TEMPO);
  }, []);

  // ---- transcribe (real Basic Pitch in Phase 2) ------------------------
  const startTranscribing = React.useCallback(async () => {
    if (!track || stage === "processing") return;
    setStage("processing");
    setError(null);
    setProgress({ progress: 0, stageKey: "decode" });

    const id = ++seq.current;
    const startedAt = Date.now();

    try {
      // Phase 2: ALWAYS run the real model — including the bundled sample,
      // which is a clean synthesized melody that Basic Pitch transcribes well.
      const keyOverride =
        keyMode === "major" || keyMode === "minor"
          ? selectedKey
          : null;
      const res = await transcribeToNotes(
        track.src,
        (p) => {
          if (id === seq.current) {
            setProgress({ progress: p.fraction, stageKey: p.stage });
          }
        },
        { keyMode, key: keyOverride },
      );

      const elapsed = Date.now() - startedAt;
      const finalNotes = res.notes;
      const finalTempo = res.tempo === undefined ? DEFAULT_TEMPO : res.tempo;

      if (id !== seq.current) return;

      // Guarantee a fitted progress to 100% (real progress may stop < 1).
      setProgress({ progress: 1, stageKey: "done" });
      setNotes(finalNotes);
      setTempo(finalTempo);
      setDetectedKey(res.key);
      setStage("done");

      // Small buffer so the overlay dips to 100% before it closes.
      const minLeft = PROCESSING_MIN_MS - elapsed;
      if (minLeft > 0) await delay(Math.min(minLeft + 200, 1200));

      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      if (id !== seq.current) return;
      setStage("uploaded");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [track, stage, keyMode, selectedKey]);

  // ---- export handlers --------------------------------------------------
  const handleExportJson = React.useCallback(() => {
    const data = {
      app: "PianoMind AI",
      version: "1.0.0-phase2",
      source: track ? { name: track.name, kind: track.kind } : null,
      tempo,
      noteCount: notes.length,
      notes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName(track?.name ?? "transcription")}.pianomind.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }, [notes, tempo, track]);

  const handleExportMidi = React.useCallback(async () => {
    try {
      const bytes = await exportMidi(notes, {
        tempo,
        name: track?.name ?? "PianoMind AI",
      });
      downloadBytes(
        bytes,
        `${baseName(track?.name ?? "transcription")}.mid`,
        "audio/midi",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [notes, tempo, track]);

  const hasTrack = !!track;
  const isProcessing = stage === "processing";

  return (
    <div className="flex min-h-screen flex-col bg-glow">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Studio header / toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                title={dict.studio.header.back}
              >
                <Link href="/" aria-label={dict.studio.header.back}>
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold tracking-tight">
                {dict.studio.title}
              </h1>
              <Badge
                variant={
                  stage === "done"
                    ? "cyan"
                    : stage === "processing"
                      ? "violet"
                      : "outline"
                }
              >
                {stage === "done"
                  ? `${notes.length} ${dict.studio.header.notesUnit} · MIDI`
                  : stage === "processing"
                    ? dict.studio.header.processing
                    : dict.studio.header.badgeDraft}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-9">
              <p className="text-sm text-muted-foreground">
                {dict.studio.subtitle}
              </p>
              {stage === "done" && detectedKey && (
                <Badge variant="violet">
                  {dict.studio.keyDetected}:{" "}
                  {keyLabel(detectedKey)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Key signature quantization selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="key-select"
                className="text-xs text-muted-foreground"
              >
                {dict.studio.keyLabel}:
              </label>
              <select
                id="key-select"
                value={keyMode}
                onChange={(e) => {
                  const v = e.target.value as KeyMode;
                  setKeyMode(v);
                  if (v === "major" || v === "minor") {
                    setSelectedKey(
                      (prev) =>
                        prev ??
                        (v === "major"
                          ? { tonic: 0, mode: "major" }
                          : { tonic: 9, mode: "minor" }),
                    );
                  }
                }}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-violet-500/60"
              >
                <option value="auto">{dict.studio.keyAuto}</option>
                <option value="chromatic">
                  {dict.studio.keyChromatic}
                </option>
                <option value="major">{dict.studio.keyMajor}</option>
                <option value="minor">{dict.studio.keyMinor}</option>
              </select>
            </div>

            {(keyMode === "major" || keyMode === "minor") && (
              <select
                aria-label={dict.studio.keyLabel}
                value={selectedKey ? `${selectedKey.tonic}|${selectedKey.mode}` : ""}
                onChange={(e) => {
                  const [t, m] = e.target.value.split("|");
                  setSelectedKey({
                    tonic: Number(t),
                    mode: m as "major" | "minor",
                  });
                }}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs outline-none focus:border-violet-500/60"
              >
                {ALL_KEYS.filter((k) => k.mode === keyMode).map((k) => (
                  <option key={`${k.tonic}-${k.mode}`} value={`${k.tonic}|${k.mode}`}>
                    {keyLabel(k)}
                  </option>
                ))}
              </select>
            )}

            <Button
              onClick={startTranscribing}
              disabled={!hasTrack || isProcessing}
              variant="default"
            >
              {isProcessing ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {dict.studio.header.transcribe}
            </Button>

            {stage === "done" && notes.length > 0 && (
              <Button onClick={handleExportMidi} variant="cyan">
                <FileMusic className="size-4" />
                {dict.studio.header.exportMidi}
              </Button>
            )}
            <Button
              onClick={handleExportJson}
              disabled={stage !== "done" || notes.length === 0}
              variant="outline"
            >
              {notes.length > 0 ? (
                <FileJson className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {dict.studio.header.exportJson}
            </Button>
          </div>
        </div>

        {/* Upload zone */}
        <section className="mt-6">
          <UploadZone
            stage={stage}
            track={track}
            onFile={handleFile}
            onUrl={handleUrl}
            onSample={handleSample}
            onClear={clearSession}
          />
        </section>

        {/* Waveform player */}
        <section className="mt-4">
          <WaveformPlayer
            ref={playerRef}
            src={track?.src ?? null}
            trackName={track?.name ?? null}
            disabled={!hasTrack || isProcessing}
            onTimeUpdate={(t) => setPlayheadTime(t)}
            onError={(msg) => setError(msg)}
          />
          {error && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </section>

        {/* Result viewer */}
        <section ref={resultRef} className="mt-6 scroll-mt-24">
          <Tabs defaultValue="pianoroll" className="w-full">
            <div className="mb-4 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="pianoroll">
                  {dict.studio.viewer.pianoRoll}
                </TabsTrigger>
                <TabsTrigger value="sheet">
                  {dict.studio.viewer.sheetMusic}
                </TabsTrigger>
              </TabsList>
              {stage !== "done" && (
                <span className="text-xs text-muted-foreground">
                  {dict.studio.upload.processingHint}
                </span>
              )}
            </div>

            <TabsContent value="pianoroll">
              {stage === "done" && notes.length > 0 ? (
                <PianoRollVisualizer
                  notes={notes}
                  tempo={tempo}
                  playheadTime={playheadTime}
                  onSeek={(seconds) => playerRef.current?.seek(seconds)}
                />
              ) : stage === "done" && notes.length === 0 ? (
                <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-border bg-card/30">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Sparkles className="size-10" />
                    <p className="text-sm">
                      {dict.studio.pianoRoll.empty}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="sheet">
              {stage === "done" && notes.length > 0 ? (
                <SheetMusicPreview notes={notes} tempo={tempo} />
              ) : (
                <SheetMusicPlaceholder />
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <Footer />

      <ProcessingOverlay stage={stage} info={progress} />
    </div>
  );
}

/* ---- Sheet music preview (Phase 2: live note list; staff in Phase 3) -- */

function SheetMusicPreview({
  notes,
  tempo,
}: {
  notes: NoteData[];
  tempo: number;
}) {
  const { dict } = useLanguage();
  const sorted = [...notes].sort((a, b) => a.start - b.start);

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AudioWaveform className="size-4 text-cyan-300" />
          {dict.studio.viewer.placeholderTitle}
        </div>
        <Badge variant="violet" className="font-mono">
          {Math.round(tempo)} BPM · {sorted.length} {dict.studio.header.notesUnit}
        </Badge>
      </div>

      <div className="grid max-h-96 grid-cols-2 gap-1 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
        {sorted.map((n, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 font-mono text-xs"
          >
            <span className="font-semibold text-cyan-200">{midiToName(n.midi)}</span>
            <span className="text-muted-foreground">
              {n.start.toFixed(2)}s
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {dict.studio.viewer.placeholderDesc}
      </p>
    </div>
  );
}
