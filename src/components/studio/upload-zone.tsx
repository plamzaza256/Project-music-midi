"use client";

import { Music4, UploadCloud, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import type { Dict } from "@/i18n";
import type { ProcessStage } from "@/lib/studio/types";

export type TrackKind = "file" | "url" | "sample";

export const ACCEPT_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "mp4",
  "webm",
  "mov",
  "m4v",
] as const;

export const ACCEPT_ATTR = ".mp3,.wav,.m4a,.aac,.ogg,.oga,.mp4,.webm,.mov,.m4v";

export const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

type Props = {
  stage: ProcessStage;
  /** Null until the user has loaded/uploaded something. */
  track: { name: string; kind: TrackKind; isVideo?: boolean } | null;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  onSample: () => void;
  onClear: () => void;
};

export function UploadZone(props: Props) {
  const { stage, track, onFile, onUrl, onSample, onClear } = props;
  const { dict } = useLanguage();
  const [drag, setDrag] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const hasTrack = !!track;

  function handleFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (!file) return;
    setError(null);
    onFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
  }

  const busy = stage === "processing";

  // ---- Ready state: show the loaded track ------------------------------
  if (hasTrack && track) {
    return (
      <ReadyCard
        track={track}
        busy={busy}
        onClear={() => {
          onClear();
          setUrlValue("");
        }}
        dict={dict}
      />
    );
  }

  // ---- Idle state: drop zone + url -------------------------------------
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDrag(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/40 px-6 py-12 text-center transition-all",
          drag &&
            "scale-[1.01] border-cyan-400/70 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]",
        )}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-400/20 text-cyan-300">
          <UploadCloud className="size-7" />
        </span>
        <div>
          <p className="font-semibold">{dict.studio.upload.idleTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {dict.studio.upload.idleHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <Badge variant="violet">{dict.studio.upload.formats}</Badge>
          <Badge variant="outline">{dict.studio.upload.maxSize}</Badge>
        </div>

        <div className="mt-1 flex gap-2">
          {/* A native <label> wrapping a file input fires the OS file picker
              without JS window.open/custom clicks — reliable inside iframes
              and sandboxed previews. */}
          <label
            className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground shadow transition-colors hover:bg-accent/90 [&_svg]:size-4"
          >
            {dict.studio.upload.browse}
            <input
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSample();
            }}
          >
            <Music4 className="size-4" />
            {dict.studio.upload.demo}
          </Button>
        </div>
      </div>

      {/* URL row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
            URL
          </span>
          <input
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlValue.trim()) {
                onUrl(urlValue.trim());
              }
            }}
            placeholder={dict.studio.upload.urlPlaceholder}
            aria-label={dict.studio.upload.urlLabel}
            className="h-10 w-full rounded-lg border border-border bg-card pl-12 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <Button
          type="button"
          size="default"
          variant="secondary"
          className="shrink-0"
          disabled={!urlValue.trim()}
          onClick={() => onUrl(urlValue.trim())}
        >
          {dict.studio.upload.loadUrl}
        </Button>
      </div>

      {/* URL guidance */}
      <p className="text-xs text-muted-foreground">
        {dict.studio.upload.urlHint}
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Validate a user-picked file and return a friendly error message (or null).
 * Centralized so both UploadZone and the Studio page can reuse it.
 */
export function validateFile(file: File, dict: Dict): string | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ACCEPT_EXTENSIONS.includes(ext as never)) {
    return `${dict.studio.upload.unsupported} ${file.name}`;
  }
  if (file.size > MAX_SIZE) {
    return `${dict.studio.upload.maxSize} — ${dict.studio.upload.formats}`;
  }
  return null;
}

function ReadyCard({
  track,
  busy,
  onClear,
  dict,
}: {
  track: { name: string; kind: TrackKind; isVideo?: boolean };
  busy: boolean;
  onClear: () => void;
  dict: Dict;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
      <div className="flex items-center gap-4 p-4">
        {track.isVideo ? (
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
            <video
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-border bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-cyan-300">
            <Music4 className="size-7" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{track.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={track.kind === "sample" ? "violet" : "cyan"}>
              {track.kind === "sample"
                ? dict.studio.upload.demo
                : track.kind === "url"
                  ? "URL"
                  : "FILE"}
            </Badge>
            {track.isVideo && (
              <Badge variant="outline">{dict.studio.upload.videoHint}</Badge>
            )}
            <span>{dict.studio.upload.processingHint}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClear}
          disabled={busy}
          aria-label={dict.studio.upload.change}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
