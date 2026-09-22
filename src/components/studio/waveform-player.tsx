"use client";

import WaveSurfer from "wavesurfer.js";
import {
  CloudUpload,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/language-provider";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Props = {
  src: string | null;
  trackName: string | null;
  disabled?: boolean;
  /** Called once audio metadata loads (duration). */
  onReady?: (duration: number) => void;
  onError?: (message: string) => void;
};

export function WaveformPlayer({
  src,
  trackName,
  disabled = false,
  onReady,
  onError,
}: Props) {
  const { dict } = useLanguage();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);

  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [current, setCurrent] = React.useState(0);
  const [speedIdx, setSpeedIdx] = React.useState(2);

  // ---- create / destroy WaveSurfer once -------------------------------
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      height: 96,
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      cursorWidth: 1,
      progressColor: "#8b5cf6", // violet
      waveColor: "#3a3a4a",
      cursorColor: "#ffffff",
      interact: true,
      dragToSeek: false,
      autoCenter: true,
      autoScroll: false,
      normalize: true,
    });

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setReady(true);
      onReady?.(ws.getDuration());
    });
    ws.on("audioprocess", (t: number) => setCurrent(t));
    ws.on("timeupdate", (t: number) => setCurrent(t));
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => setPlaying(false));
    ws.on("error", () => {
      setReady(false);
      onError?.("waveform error");
    });

    wsRef.current = ws;
    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- load source -----------------------------------------------------
  React.useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !src) return;
    setReady(false);
    setCurrent(0);
    setDuration(0);
    ws.load(src).catch(() => {
      onError?.("load failed");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ---- speed -----------------------------------------------------------
  React.useEffect(() => {
    wsRef.current?.setPlaybackRate(SPEEDS[speedIdx]!, true);
  }, [speedIdx]);

  // ---- mute ------------------------------------------------------------
  React.useEffect(() => {
    wsRef.current?.setMuted(muted);
  }, [muted]);

  const togglePlay = React.useCallback(() => {
    const ws = wsRef.current;
    if (ws) void ws.playPause();
  }, []);

  const toggleMute = React.useCallback(() => setMuted((m) => !m), []);

  const fmt = formatTime;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Transport + waveform */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="icon"
              variant="default"
              onClick={togglePlay}
              disabled={disabled || !ready}
              aria-label={playing ? dict.studio.player.pause : dict.studio.player.play}
              className="shrink-0"
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 translate-x-[1px]" />
              )}
            </Button>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {trackName ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ready ? (
                  <span className="font-mono">
                    {fmt(current)} / {fmt(duration)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    {src ? (
                      <>
                        <CloudUpload className="size-3" />
                        {dict.common.loading}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              disabled={!ready}
              className="grid size-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label={muted ? dict.studio.player.unmute : dict.studio.player.mute}
              aria-pressed={muted}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            {ready && (
              <Badge variant="outline" className="font-mono">
                {SPEEDS[speedIdx]!.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×
              </Badge>
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className={cn(
            "waveform w-full",
            (disabled || !ready) && "pointer-events-none opacity-70",
          )}
        />
      </div>

      {/* Speed slider */}
      <div className="shrink-0 sm:w-44">
        <p className="mb-1.5 text-xs text-muted-foreground">
          {dict.studio.player.speed}
        </p>
        <Slider
          min={0}
          max={SPEEDS.length - 1}
          step={1}
          value={[speedIdx]}
          onValueChange={(v) => setSpeedIdx(v[0] ?? 2)}
          disabled={disabled || !ready}
          aria-label={dict.studio.player.speed}
        />
        <div className="mt-1 flex justify-between text-[10px] font-mono text-muted-foreground/70">
          <span>0.5×</span>
          <span className="text-cyan-300">{(SPEEDS[speedIdx] ?? 1).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×</span>
          <span>2×</span>
        </div>
      </div>
    </div>
  );
}

export { SPEEDS };
