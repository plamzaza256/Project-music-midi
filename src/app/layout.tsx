import type { Metadata, Viewport } from "next";

import { LanguageProvider } from "@/components/language-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PianoMind AI — แกะเพลงเป็นเปียโนและโน้ต | AI Music Transcription",
    template: "%s",
  },
  description:
    "Turn any song into a piano roll and sheet music with AI. Upload audio, video, or a link and get synced piano playback — all in your browser.",
  keywords: [
    "music transcription",
    "audio to midi",
    "piano roll",
    "sheet music",
    "AI music",
    "Basic Pitch",
    "แกะเพลง",
    "โน้ตเพลง",
  ],
  openGraph: {
    title: "PianoMind AI — AI Music Transcription",
    description:
      "Turn any song into piano & sheet music with AI. Synced piano playback, in your browser.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#111118",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className="h-full scroll-smooth antialiased"
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
