import { NextResponse } from "next/server";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { getRenderHistory, cleanupExpiredRenders } from "@/lib/db";
import type { RenderRequest } from "@/types";

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { await cleanupExpiredRenders(); } catch { /* ignore */ }

  const body = (await request.json()) as RenderRequest;
  const { surah, ayahStart, ayahEnd, reciterId, templateId, format, backgroundVideos, arabicFont, wordHighlight, audioWaveform, transitionEffect, calligraphyEntrance, surahIntro, projectId, dataSource } = body;

  if (!surah || !ayahStart || !ayahEnd || !reciterId || !templateId) {
    return NextResponse.json(
      { error: "Missing required fields: surah, ayahStart, ayahEnd, reciterId, templateId" },
      { status: 400 }
    );
  }

  // Dynamic import to avoid pulling in Remotion/FFmpeg/better-sqlite3 at bundle time
  const { triggerRender } = await import("@/lib/render");

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      const result = await triggerRender(
        surah, ayahStart, ayahEnd, reciterId, templateId,
        format || "vertical",
        backgroundVideos || [],
        arabicFont || "amiri-quran",
        wordHighlight || false,
        audioWaveform || false,
        transitionEffect || "none",
        calligraphyEntrance || false,
        surahIntro || false,
        userId,
        projectId,
        async (stage, progress, jobId) => {
          await sendEvent({ type: "progress", stage, progress, jobId });
        },
        dataSource || "local"
      );
      const filename = path.basename(result.outputPath);
      const downloadUrl = `/api/download?file=${encodeURIComponent(filename)}`;
      await sendEvent({ type: "complete", jobId: result.jobId, downloadUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed";
      const isCancelled = message.includes("cancelled") || message.includes("Cancel");
      await sendEvent({ type: isCancelled ? "cancelled" : "error", error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { await cleanupExpiredRenders(); } catch { /* ignore */ }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  return NextResponse.json(
    await getRenderHistory(userId, projectId ? parseInt(projectId, 10) : undefined)
  );
}
