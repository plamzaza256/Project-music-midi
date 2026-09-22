import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — PianoMind AI",
  description:
    "Upload audio, video, or a link and let PianoMind AI transcribe it into a piano roll & sheet music with synced piano playback.",
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
