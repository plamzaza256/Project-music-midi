# PRD — PianoMind AI

> AI-powered music transcription web app — turn any song into a piano roll & sheet music,
> with synced piano playback.
> เว็บแอปแกะเพลงด้วย AI — แปลงเพลงเป็น Piano Roll และโน้ต (Sheet Music) พร้อมเล่นเสียงเปียโนซิงค์กับเพลงต้นฉบับ

## 1. Overview

PianoMind AI lets a user upload a song (audio, video, or a link), and the app uses AI
(Basic Pitch) to transcribe it into a **Piano Roll** view and **Sheet Music** notation.
The user can then play the result back as a piano sound, synchronized with the original track.

| Field | Value |
| --- | --- |
| Product | PianoMind AI |
| Type | Web Application |
| Primary users | Musicians, students, producers, hobbyists |
| Key workflow | Upload → Transcribe (AI) → Piano Roll + Sheet Music → Synced playback |

## 2. Goals & Success Metrics

- Make music transcription accessible in the browser (no DAW required).
- Reduce time from raw audio to readable notation.
- Provide a delightful, semi-dark, "studio-like" UI.

**Success metrics (v1):** upload → transcription pipeline works end-to-end; piano roll/sheet
views render the transcribed result; playback stays in sync with the source.

## 3. Tech Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS |
| UI primitives | Shadcn UI |
| Waveform | WaveSurfer.js |
| Audio synthesis (piano sound) | Tone.js |
| Transcription AI | Basic Pitch (Spotify) |
| i18n | TH / EN toggle (in-app dictionary) |

## 4. Design System — Semi-Dark Studio

| Token | Value |
| --- | --- |
| Background | `#111118` (semi-dark, slight blue tint) |
| Surface | `#1a1a24` / `#202030` |
| Primary accent | Violet (≈ `#8b5cf6`) |
| Secondary accent | Cyan (≈ `#22d3ee`) |
| Text | Near-white `#e5e7eb`, muted `#9ca3af` |
| Feel | Modern, minimal, "neon studio" — violet/cyan glows on dark |

Default theme is dark. Language toggle (TH/EN) is always visible in the navbar/toolbar.

## 5. Core Features

1. **Input** — Upload audio/video (`.mp3`, `.wav`, `.mp4`) or paste a link.
2. **Waveform** — WaveSurfer.js player with play/pause, seek, and **speed control**.
3. **Transcription (AI)** — Basic Pitch converts audio → MIDI notes inside the browser.
4. **Piano Roll** — Interactive piano roll visualization of detected notes.
5. **Sheet Music** — Rendered notation from the same MIDI.
6. **Synced Playback** — Piano sound (Tone.js) plays the transcription in sync with the original.

## 6. Phases (Roadmap)

| Phase | Scope |
| --- | --- |
| **Phase 1** | UI & Mock Studio — scaffold, theme, i18n, landing, studio layout, upload, waveform + speed, mock piano roll, view switcher, loading animation |
| Phase 2 | Basic Pitch integration — real audio→MIDI transcription in browser |
| Phase 3 | Sheet music rendering, piano sound (Tone.js) sync, export (MIDI/PDF) |
| Phase 4 | Link input, polish, performance, deployment |

## 7. Non-functional requirements

- Works in modern browsers (Chrome/Firefox/Safari/Edge).
- Fully client-side transcription (privacy — audio never leaves the device).
- Responsive: desktop-first studio, mobile-friendly landing.
- Accessible: keyboard navigable controls, ARIA labels, focus states.

## 8. Language (TH/EN)

All UI strings live in one dictionary. Users can switch Thai ⇄ English instantly; the choice
is persisted and remembered across visits.
