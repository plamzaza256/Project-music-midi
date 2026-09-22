"use client";

import Link from "next/link";
import { ArrowLeft, Download, FileJson, Sparkles } from "lucide-react";
import * as React from "react";

import { Footer, Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/studio/upload-zone";
import { WaveformPlayer } from "@/components/studio/waveform-player";
import { PianoRollVisualizer } from "@/components/studio/piano-roll-visualizer";
import { SheetMusicPlaceholder } from "@/components/studio/sheet-music-placeholder";
import { ProcessingOverlay } from "@/components/studio/processing-overlay";
import { generateMockNotes } from "@/lib/studio/notes";
import {
  DEMO_TRACK,
  type ProcessStage,
  type NoteData,
} from "@/lib/studio/types";

const PROCESSING_MS = 4200;

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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
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

  const timerRef = React.useRef<number | null>(null);
  const resultRef = React.useRef<HTMLDivElement | null>(null);
  const seq = React.useRef(0);

  // Clear any pending transcribe timer on unmount.
  React.useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clearSession = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (track?.objectUrl) URL.revokeObjectURL(track.objectUrl);
    setTrack(null);
    setNotes([]);
    setStage("idle");
    setError(null);
  }, [track]);

  // ---- input handlers ---------------------------------------------------
  const handleFile = React.useCallback(
    (file: File) => {
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
    },
    [],
  );

  const handleUrl = React.useCallback((url: string) => {
    setError(null);
    setTrack({ name: url.split("/").pop()?.slice(0, 60) || url, kind: "url", src: url });
    setNotes([]);
    setStage("uploaded");
  }, []);

  const handleSample = React.useCallback(() => {
    setError(null);
    setTrack({ name: DEMO_TRACK.name, kind: "sample", src: DEMO_TRACK.src });
    setNotes([]);
    setStage("uploaded");
  }, []);

  // ---- transcribe (simulated in Phase 1) --------------------------------
  const startTranscribing = React.useCallback(() => {
    if (!track || stage === "processing") return;
    setStage("processing");
    setError(null);
    const id = ++seq.current;
    const beatCount = 48 + (hashString(track.name) % 48);

    timerRef.current = window.setTimeout(() => {
      if (id !== seq.current) return;
      setNotes(generateMockNotes(hashString(track.name), beatCount));
      setStage("done");
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, PROCESSING_MS);
  }, [track, stage]);

  const handleExport = React.useCallback(() => {
    downloadJson(
      `${(track?.name ?? "transcription").replace(/\.\w+$/, "")}.pianomind.json`,
      {
        app: "PianoMind AI",
        version: "1.0.0-phase1",
        source: track
          ? { name: track.name, kind: track.kind }
          : null,
        noteCount: notes.length,
        notes,
      },
    );
  }, [notes, track]);

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
              <Button asChild variant="ghost" size="icon-sm" title={dict.studio.header.back}>
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
                  ? `${notes.length} ${dict.studio.header.badgeDraft} · MIDI`
                  : stage === "processing"
                    ? dict.common.loading
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
            <Button
              onClick={handleExport}
              disabled={stage !== "done" || notes.length === 0}
              variant="outline"
            >
              {notes.length > 0 ? (
                <FileJson className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {dict.studio.header.export}
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
            src={track?.src ?? null}
            trackName={track?.name ?? null}
            disabled={!hasTrack || isProcessing}
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
                <PianoRollVisualizer notes={notes} />
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="sheet">
              <SheetMusicPlaceholder />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <Footer />

      <ProcessingOverlay stage={stage} />
    </div>
  );
}
