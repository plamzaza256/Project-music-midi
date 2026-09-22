"use client";

import Link from "next/link";
import { AudioWaveform, Menu, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

function LangToggle() {
  const { locale, toggle } = useLanguage();
  const label =
    locale === "th"
      ? "Switch to English"
      : "เปลี่ยนเป็นภาษาไทย";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="gap-1.5 border border-border font-semibold tracking-wide text-muted-foreground hover:text-foreground"
    >
      <span className={cn("text-xs", locale === "th" ? "opacity-50" : "text-cyan-300")}>EN</span>
      <span className="text-xs text-border">/</span>
      <span className={cn("text-xs", locale === "en" ? "opacity-50" : "text-violet-300")}>TH</span>
    </Button>
  );
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
        <AudioWaveform className="size-4.5 text-white" aria-hidden="true" />
      </span>
      <span className="text-[15px] font-bold tracking-tight">
        PianoMind<span className="text-gradient bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent"> AI</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { dict } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const links = [
    { href: "/#features", label: dict.nav.features },
    { href: "/#how", label: dict.nav.howItWorks },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/studio"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {dict.nav.studio}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href="/studio">{dict.common.openStudio}</Link>
          </Button>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <Button asChild className="mt-2">
              <Link href="/studio" onClick={() => setOpen(false)}>
                {dict.common.openStudio}
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { dict } = useLanguage();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <Brand />
        </div>
        <p>
          © {year} PianoMind AI — {dict.landing.footer.rights}
        </p>
        <p className="text-xs">{dict.landing.footer.madeWith}</p>
      </div>
    </footer>
  );
}
