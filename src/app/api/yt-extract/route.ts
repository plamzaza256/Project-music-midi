import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";

/**
 * Server-side YouTube audio proxy.
 *
 * Browsers can't fetch YouTube/googlevideo directly (CORS + signature
 * requirements), so this route resolves the YouTube URL server-side with
 * ytdl-core and streams back the raw audio bytes (Range-aware) so WaveSurfer
 * can play and analyze it from our own origin.
 *
 *   GET /api/yt-extract?url=<youtube-url>
 *
 * NOTE: the sandbox that hosts the Live Preview has no egress to
 * youtube.com/googlevideo.com, so this route works where deployed (Vercel,
 * local machine, etc.) but will report a network error inside this preview.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB safety cap
const MAX_TITLE_LENGTH = 120;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function isYoutubeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      /(^|\.)youtube\.com$/.test(u.hostname) ||
      /(^|\.)youtube-nocookie\.com$/.test(u.hostname) ||
      u.hostname === "youtu.be"
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!url) return errorResponse(400, "Missing `url` query parameter.");
  if (!isYoutubeUrl(url)) {
    return errorResponse(400, "The provided URL is not a YouTube link.");
  }

  let videoId: string;
  try {
    videoId = ytdl.getURLVideoID(url);
  } catch {
    return errorResponse(400, "Could not parse a video ID from this URL.");
  }

  // 1. Resolve video info (this is the step that needs youtube.com egress).
  let info: Awaited<ReturnType<typeof ytdl.getInfo>>;
  try {
    info = await ytdl.getInfo(videoId);
  } catch (e) {
    console.error("[yt-extract] getInfo failed:", e);
    return errorResponse(
      502,
      "Could not reach YouTube to resolve this video (network/region issue).",
    );
  }

  // 2. Prefer an audio-only, AAC/MP4 container (max Safari/audiocontext compat).
  //    ytdl reports m4a/bestaudio formats with container "mp4" or "webm".
  const audioOnly = info.formats.filter((f) => f.hasAudio && !f.hasVideo);
  const chosen =
    audioOnly.find((f) => f.container === "mp4") ??
    audioOnly.find((f) => f.container === "webm") ??
    audioOnly[0] ??
    ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

  if (!chosen?.url) {
    return errorResponse(404, "No extractable audio stream for this video.");
  }

  // 3. Forward the client's Range header to googlevideo (enables seeking).
  const rangeHeader = req.headers.get("range");
  const upstream = await fetch(chosen.url, {
    headers: rangeHeader ? { Range: rangeHeader } : undefined,
    redirect: "follow",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return errorResponse(
      502,
      `Upstream audio stream failed (HTTP ${upstream.status}).`,
    );
  }

  // 4. Safety cap so a malicious 10-hour video can't OOM the server.
  const contentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return errorResponse(
      413,
      "Audio stream too large (limit 100 MB). Try a shorter video.",
    );
  }

  // 5. Stream the audio back under our origin (same-origin for WaveSurfer).
  const headers = new Headers();
  const type =
    chosen.mimeType?.split(";")[0]?.trim() || "audio/mpeg";
  headers.set("Content-Type", type);
  headers.set("Accept-Ranges", "bytes");
  const upstreamLen = upstream.headers.get("content-length");
  if (upstreamLen) headers.set("Content-Length", upstreamLen);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);
  headers.set("Cache-Control", "no-store");

  const title =
    (info.videoDetails?.title ?? `YouTube (${videoId})`).slice(
      0,
      MAX_TITLE_LENGTH,
    );
  headers.set("X-Video-Title", encodeURIComponent(title));

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
