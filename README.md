# 🎹 PianoMind AI

> AI-powered music transcription web app — turn any song into a **piano roll** & **sheet music**,
> with synced piano playback.
> เว็บแอปแกะเพลงด้วย AI — แปลงเพลงเป็น **Piano Roll** และ **Sheet Music** พร้อมเล่นเสียงเปียโนซิงค์กับเพลงต้นฉบับ

Semi-dark studio UI (`#111118`) with violet/cyan accents · TH/EN bilingual.

## ✨ Features (Phase 1 — UI & Mock Studio)

- **Next.js 16** (App Router) + **Tailwind CSS v4** + **Shadcn UI** (New York style)
- **Theme & Language** — สลับไทย/อังกฤษได้ทันที (จำค่าไว้ใน localStorage)
- **Landing Page** — Hero, Features, How-it-works
- **Studio Page** — อัปโหลดเสียง/วิดีโอ/ลิงก์ → เล่น waveform → แกะเพลง (จำลอง) → ดูผล
- **Upload Zone** — drag & drop รองรับ MP3 · WAV · MP4 · M4A (สูงสุด 50 MB) + วางลิงก์
- **Waveform Player** — [WaveSurfer.js](https://wavesurfer.xyz/) เล่น/หยุด/seek + ปรับความเร็ว 0.5×–2× + ปิดเสียง
- **Piano Roll** (mock data) — แสดงโน้ตบนคีย์เปียโน พร้อม beat grid และแถบคีย์
- **View Switcher** — สลับ Piano Roll ⇆ Sheet Music placeholder
- **AI Processing Animation** — overlay จำลองขั้นตอนการแกะเพลง

## 🚀 Getting started

```bash
npm install        # ติดตั้ง dependencies
npm run dev        # เริ่ม dev server → http://localhost:3000
npm run build      # build สำหรับ production
npm run start      # รัน build ที่ได้
npm run lint       # ตรวจ ESLint
```

## 🧭 Tech stack

| Layer | Tech |
| --- | --- |
| Framework | [Next.js](https://nextjs.org/) (App Router, TypeScript) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| UI | [Shadcn UI](https://ui.shadcn.com/) (Radix + CVA + lucide) |
| Waveform | [WaveSurfer.js](https://wavesurfer.xyz/) |
| Animation | [Motion](https://motion.dev/) (framer-motion) |
| Audio / AI (Phase 2+) | [Tone.js](https://tonejs.github.io/), [Basic Pitch](https://github.com/spotify/basic-pitch) |

## 📁 Project structure

```
src/
├── app/
│   ├── layout.tsx          # root layout + metadata
│   ├── page.tsx            # landing page
│   └── studio/
│       ├── layout.tsx      # studio metadata
│       └── page.tsx        # studio (state machine + wiring)
├── components/
│   ├── ui/                 # shadcn components (button, badge, tabs, …)
│   ├── studio/             # upload-zone, waveform-player, piano-roll, …
│   ├── header.tsx          # header + footer + lang toggle
│   └── language-provider.tsx
├── i18n/                   # en.json / th.json dictionaries
└── lib/
    ├── utils.ts            # cn(), formatTime()
    └── studio/             # mock notes, piano-roll geometry
```

## 🗺️ Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| **1** | UI & Mock Studio | ✅ done |
| 2 | Basic Pitch audio → MIDI | backlog |
| 3 | Sheet music + Tone.js sync + export | backlog |

See [`PRD.md`](./PRD.md) and [`TASKS.md`](./TASKS.md) for full details.

---

### Note on the demo track

The "Try sample audio" button streams a short Wikimedia Commons clip
(**MainTheme with a touch of Nuvole Bianche** by ppo). The file is not bundled
with the repo — see [`LICENSE_NOTES.md`](./LICENSE_NOTES.md) for attribution.
