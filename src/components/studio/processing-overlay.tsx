"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import { AudioWaveform, Check } from "lucide-react";

import { type ProcessStage } from "@/lib/studio/types";
import { useLanguage } from "@/components/language-provider";
import { MotionDiv } from "@/components/ui/motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STAGE_STEP_DURATION = 850; // ms per label step (threshold fallback)

export type ProcessingInfo = {
  /** 0..1 overall progress from the transcription engine. */
  progress: number;
  /** Internal stage key ("decode" | "preprocess" | "model" | "convert" | "refine" | "done"). */
  stageKey: string;
};

type Props = {
  stage: ProcessStage;
  info: ProcessingInfo;
};

/*
 * Maps engine stages → the 7-step UI list order. `model` spans several steps
 * (dataset, decompose, tempo) because inference is the long phase; `refine`
 * points at the final "polishing" step.
 */
const STAGE_TO_STEP: Record<string, number> = {
  decode: 0,
  preprocess: 1,
  model: 2,
  convert: 5,
  refine: 6,
  done: 6,
};

function labelIndexFor(stageKey: string): number {
  return STAGE_TO_STEP[stageKey] ?? 0;
}

/**
 * Full-screen AI "transcribing" overlay. In Phase 2 it shows real progress
 * from the Basic Pitch pipeline; the checkmark steps advance with progress
 * (with a timer fallback while the model's first frame is loading).
 */
export function ProcessingOverlay({ stage, info }: Props) {
  const { dict } = useLanguage();
  const active = stage === "processing";
  const steps = dict.studio.processing.steps;

  const pct = Math.min(100, Math.max(4, Math.round(info.progress * 100)));

  return (
    <AnimatePresence>
      {active && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-background/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={dict.studio.processing.title}
        >
          <MotionDiv
            initial={{ scale: 0.94, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 6 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl shadow-violet-950/40"
          >
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-cyan-400/20" />
              <span className="relative grid h-16 w-16 place-items-center rounded-full border border-violet-400/40 bg-gradient-to-br from-violet-600 to-cyan-400 text-white shadow-[0_0_30px_rgba(139,92,246,0.6)]">
                <AudioWaveform className="size-7" />
              </span>
            </div>

            <h2 className="mt-6 text-lg font-semibold">
              {dict.studio.processing.title}
            </h2>

            {/* Progress bar */}
            <div className="mt-4">
              <Progress value={pct} variant="gradient" className="h-2.5" />
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {pct}%
              </p>
            </div>

            <StepsPanel steps={steps} info={info} />
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}

function StepsPanel({
  steps,
  info,
}: {
  steps: string[];
  info: ProcessingInfo;
}) {
  const [timerStep, setTimerStep] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setTimerStep((s) => Math.min(s + 1, steps.length - 2));
    }, STAGE_STEP_DURATION);
    return () => window.clearInterval(id);
  }, [steps.length]);

  // Which step is "current" — driven by the real progress when available.
  const labelIdx = labelIndexFor(info.stageKey);
  const progressStep = Math.max(labelIdx, timerStep);

  return (
    <ul className="mt-5 space-y-2.5 text-left">
      {steps.map((label, i) => {
        const done = i < progressStep;
        const isCurrent = i === progressStep;
        return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
                      isCurrent && "border-violet-500/30 bg-violet-500/10",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                        done &&
                          "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
                        isCurrent &&
                          "border-cyan-400/50 bg-cyan-400/15 text-cyan-300",
                        !done && !isCurrent &&
                          "border-border text-muted-foreground/50",
                      )}
                    >
                      {done ? (
                        <Check className="size-3.5" />
                      ) : isCurrent ? (
                        <span className="size-2 animate-pulse rounded-full bg-cyan-300" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex-1",
                        isCurrent
                          ? "font-medium text-foreground"
                          : done
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50",
                      )}
                    >
                      {label}
                    </span>
                  </li>
        );
      })}
    </ul>
  );
}
