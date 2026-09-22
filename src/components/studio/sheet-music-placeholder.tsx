"use client";

import { Music2 } from "lucide-react";

import { useLanguage } from "@/components/language-provider";

export function SheetMusicPlaceholder() {
  const { dict } = useLanguage();
  return (
    <div className="grid h-full min-h-[320px] place-items-center rounded-xl border border-dashed border-border bg-card/30">
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <span className="grid size-16 place-items-center rounded-full border border-border bg-gradient-to-br from-violet-500/15 to-cyan-400/15 text-cyan-300">
          <Music2 className="size-7" />
        </span>
        <div>
          <h3 className="font-semibold">
            {dict.studio.viewer.placeholderTitle}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {dict.studio.viewer.placeholderDesc}
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {dict.common.comingSoon}
        </span>
      </div>
    </div>
  );
}
