"use client";

import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  AudioWaveform,
  FileAudio,
  LockKeyhole,
  Piano,
  PlayCircle,
  Sparkles,
  UploadCloud,
  Music4,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Footer, Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";

/* Aesthetic decorations ------------------------------------------------ */

function PianoKeysMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-violet-950/40 ${className ?? ""}`}
    >
      {Array.from({ length: 14 }).map((_, i) => {
        const black = [1, 2, 4, 5, 6, 8, 9, 11, 12, 13].includes(i);
        return (
          <div
            key={i}
            className={`relative h-full flex-1 border-r border-border/60 last:border-r-0 ${
              black ? "bg-black" : "bg-gradient-to-b from-zinc-100 to-zinc-300"
            }`}
          />
        );
      })}
    </div>
  );
}

function MiniRoll({ className }: { className?: string }) {
  const notes: Array<[number, number, number, "v" | "c"]> = [
    [3, 62, 3, "v"],
    [6, 66, 2, "c"],
    [9, 69, 3, "v"],
    [13, 64, 2, "c"],
    [16, 71, 4, "v"],
    [21, 67, 2, "c"],
    [24, 74, 3, "v"],
  ];
  const rows = 10;
  return (
    <svg
      viewBox="0 0 240 130"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {Array.from({ length: rows }).map((_, y) => (
        <line
          key={y}
          x1={0}
          x2={240}
          y1={(y * 130) / (rows - 1)}
          y2={(y * 130) / (rows - 1)}
          stroke="rgba(139, 92, 246, 0.12)"
          strokeWidth={1}
        />
      ))}
      {notes.map(([x, row, w, color], i) => {
        const yy = ((rows - 1 - Math.min(row, rows - 1)) * 130) / (rows - 1);
        return (
          <rect
            key={i}
            x={x}
            y={yy - 5}
            width={w}
            height={10}
            rx={2.5}
            fill={color === "v" ? "rgba(139,92,246,0.85)" : "rgba(34,211,238,0.8)"}
          />
        );
      })}
    </svg>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md sm:max-w-lg">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-cyan-400/25 blur-2xl"
      />
      <div className="relative rounded-2xl border border-border/80 bg-card/90 p-3 shadow-2xl shadow-violet-950/40 backdrop-blur">
        <MiniRoll className="h-24 w-full rounded-lg bg-background/60" />
        <PianoKeysMark className="mt-3 h-12 w-full" />
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <PlayCircle className="size-4 text-cyan-300" />
            <span>sunset_notes.mp3</span>
          </span>
          <span className="font-mono text-cyan-300">1.0×</span>
        </div>
      </div>

      <div className="absolute -left-4 top-6 hidden rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg sm:block">
        <span className="font-mono text-violet-300">C5 · E5 · G5</span>
      </div>
      <div className="absolute -right-2 bottom-8 hidden rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg sm:block">
        <span className="text-cyan-300">128 BPM</span>
      </div>
    </div>
  );
}

/* Feature icon map ------------------------------------------------------ */
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  upload: <UploadCloud className="size-5" />,
  waveform: <AudioWaveform className="size-5" />,
  piano: <Piano className="size-5" />,
  music: <Music4 className="size-5" />,
  sync: <AudioLines className="size-5" />,
  privacy: <LockKeyhole className="size-5" />,
};

export default function HomePage() {
  const { dict } = useLanguage();

  const heroTitle1 = dict.landing.hero.title1;
  const heroAccent = dict.landing.hero.titleAccent;
  const heroTitle2 = dict.landing.hero.title2;

  const features = dict.landing.features.items;
  const steps = dict.landing.how.steps;

  return (
    <div className="flex min-h-screen flex-col bg-glow">
      <Header />

      <main className="flex-1">
        {/* ------------------------------ HERO ------------------------------ */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(139,92,246,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 70%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
            <div className="flex flex-col items-start gap-6">
              <Badge variant="violet" className="px-3 py-1">
                <Sparkles className="size-3.5" />
                {dict.landing.badge}
              </Badge>

              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="block">{heroTitle1}</span>
                <span className="text-glow block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                  {heroAccent}
                </span>
                <span className="block">{heroTitle2}</span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {dict.landing.hero.subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="group">
                  <Link href="/studio">
                    {dict.landing.cta.primary}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#how">{dict.landing.cta.secondary}</Link>
                </Button>
              </div>

              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {dict.landing.trust.map((item: string, i: number) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <HeroVisual />
          </div>
        </section>

        {/* ---------------------------- FEATURES ---------------------------- */}
        <section id="features" className="scroll-mt-20 border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                {dict.landing.features.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {dict.landing.features.title}{" "}
                <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
                  {dict.landing.features.titleAccent}
                </span>
              </h2>
              <p className="mt-3 text-muted-foreground">
                {dict.landing.features.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Card
                  key={i}
                  className="group gap-4 border-border/70 bg-card/60 py-5 transition-colors hover:border-violet-500/40 hover:bg-card"
                >
                  <CardContent className="flex flex-col gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-400/20 text-cyan-300 transition-transform group-hover:scale-110">
                      {FEATURE_ICONS[f.icon] ?? <Sparkles className="size-5" />}
                    </span>
                    <div>
                      <h3 className="font-semibold">{f.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {f.desc}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------- HOW IT WORKS ------------------------- */}
        <section id="how" className="scroll-mt-20 border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                {dict.landing.how.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {dict.landing.how.title}
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-border/70 bg-card/50 p-6"
                >
                  <span className="bg-gradient-to-br from-violet-400 to-cyan-300 bg-clip-text text-4xl font-black text-transparent">
                    {s.num}
                  </span>
                  <div className="mt-4 flex items-center gap-2">
                    {i === 0 && <FileAudio className="size-4 text-violet-300" />}
                    {i === 1 && <Sparkles className="size-4 text-fuchsia-300" />}
                    {i === 2 && <Piano className="size-4 text-cyan-300" />}
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ CTA ------------------------------- */}
        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-600/20 via-card to-cyan-500/10 px-6 py-14 text-center">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(40% 60% at 50% 0%, rgba(139,92,246,0.35), transparent)",
                }}
              />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {dict.landing.ctaBand.title}
                </h2>
                <p className="mt-3 text-muted-foreground">
                  {dict.landing.ctaBand.subtitle}
                </p>
                <Button asChild size="lg" className="group mt-8">
                  <Link href="/studio">
                    {dict.landing.ctaBand.button}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
