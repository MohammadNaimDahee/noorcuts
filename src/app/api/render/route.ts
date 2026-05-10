import { NextResponse } from "next/server";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { triggerRender } from "@/lib/render";
import { getRenderHistory, cleanupExpiredRenders } from "@/lib/db";
import type { RenderRequest } from "@/types";

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try { cleanupExpiredRenders(); } catch { /* ignore */ }

  const body = (await request.json()) as RenderRequest;
  const { surah, ayahStart, ayahEnd, reciterId, templateId, format, backgroundVideos, arabicFont, wordHighlight, audioWaveform, transitionEffect, calligraphyEntrance, projectId } = body;

  if (!surah || !ayahStart || !ayahEnd || !reciterId || !templateId) {
    return NextResponse.json(
      { error: "Missing required fields: surah, ayahStart, ayahEnd, reciterId, templateId" },
      { status: 400 }
    );
  }

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
        userId,
        projectId,
        async (stage, progress) => {
          await sendEvent({ type: "progress", stage, progress });
        }
      );
      const filename = path.basename(result.outputPath);
      const downloadUrl = `/api/download?file=${encodeURIComponent(filename)}`;
      await sendEvent({ type: "complete", jobId: result.jobId, downloadUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Render failed";
      await sendEvent({ type: "error", error: message });
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

  try { cleanupExpiredRenders(); } catch { /* ignore */ }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  return NextResponse.json(
    getRenderHistory(userId, projectId ? parseInt(projectId, 10) : undefined)
  );
}
