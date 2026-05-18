import { NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "audio.qurancdn.com",
  "audio-cdn.tarteel.ai",
  "verses.quran.com",
  "download.quranicaudio.com",
  "mirrors.quranicaudio.com",
];

// Cache fetched audio buffers in memory to support range requests without re-fetching
const audioCache = new Map<string, Buffer>();
const MAX_CACHE = 200;

async function getAudioBuffer(url: string): Promise<Buffer> {
  const cached = audioCache.get(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Upstream ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());

  // Evict oldest if cache is full
  if (audioCache.size >= MAX_CACHE) {
    const first = audioCache.keys().next().value;
    if (first) audioCache.delete(first);
  }
  audioCache.set(url, buf);
  return buf;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const buf = await getAudioBuffer(url);
    const total = buf.byteLength;
    const contentType = url.endsWith(".mp3") ? "audio/mpeg" : "audio/mpeg";

    // Handle Range requests (required for Remotion seeking)
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : total - 1;
        const chunk = buf.subarray(start, end + 1);

        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunk.byteLength),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(total),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 });
  }
}
