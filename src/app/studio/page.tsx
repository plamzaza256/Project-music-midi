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
import { UploadZone } from "@/components/studio/upload-zone";
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
import { generateMockNotes, midiToName } from "@/lib/studio/notes";
import {
  DEMO_TRACK,
  DEFAULT_TEMPO,
  type ProcessStage,
  type NoteData,
} from "@/lib/studio/types";

const PROCESSING_MIN_MS = 2500;

type Track = {
  name: string;
  kind: "file" | "url" | "sample";
  src: string;
  objectUrl?: string;
  isVideo?: boolean;
};

function hashString(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
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

  const playerRef = React.useRef<WaveformPlayerHandle | null>(null);
  const resultRef = React.useRef<HTMLDivElement | null>(null);
  const seq = React.useRef(0);

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
  }, [track]);

  // ---- input handlers ---------------------------------------------------
  const handleFile = React.useCallback((file: File) => {
    setError(null);
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
  }, []);

  const handleUrl = React.useCallback((url: string) => {
    setError(null);
    setTrack({
      name: url.split("/").pop()?.slice(0, 60) || url,
      kind: "url",
      src: url,
    });
    setNotes([]);
    setStage("uploaded");
    setTempo(DEFAULT_TEMPO);
  }, []);

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
      // Phase 1 always generated mock notes. Phase 2 uses the real model;
      // the sample (demo) track still gets a rich mock result.
      const useMock = track.kind === "sample";

      const [res] = await Promise.all([
        useMock
          ? Promise.resolve(null)
          : transcribeToNotes(track.src, (p) => {
              if (id === seq.current) {
                setProgress({ progress: p.fraction, stageKey: p.stage });
              }
            }),
        delay(PROCESSING_MIN_MS),
      ]);

      const elapsed = Date.now() - startedAt;

      let finalNotes: NoteData[];
      let finalTempo: number;

      if (useMock) {
        finalNotes = generateMockNotes(hashString(track.name), 32, DEFAULT_TEMPO);
        finalTempo = DEFAULT_TEMPO;
      } else if (res) {
        finalNotes = res.notes;
        finalTempo = res.tempo;
      } else {
        finalNotes = [];
        finalTempo = DEFAULT_TEMPO;
      }

      if (id !== seq.current) return;

      // Guarantee a fitted progress to 100% (real progress may stop < 1).
      setProgress({ progress: 1, stageKey: "done" });
      setNotes(finalNotes);
      setTempo(finalTempo);
      setStage("done");

      // Small buffer so the overlay dips to 100% before it closes.
      const minLeft = PROCESSING_MIN_MS - elapsed;
      if (minLeft > 0) await delay(Math.min(minLeft + 200, 1200));

      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      if (id !== seq.current) return;
      setStage("uploaded");
      setError(
        e instanceof Error ? e.message : String(e),
      );
    }
  }, [track, stage]);

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
            <p className="mt-1 pl-9 text-sm text-muted-foreground">
              {dict.studio.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
