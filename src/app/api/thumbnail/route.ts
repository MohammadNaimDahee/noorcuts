import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { auth } from "@clerk/nextjs/server";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  isSurahLevelReciter,
  getSurahLevelTimestamps,
} from "@/lib/quran";
import { getTemplate } from "@/lib/db";
import { fetchAyahData } from "@/lib/qf-data";
import { ARABIC_FONTS } from "@/types";
import type { VideoCompositionProps, VideoFormat, AyahTimestamp, AyahWordTimings, ArabicFontId, TransitionEffect, DataSource } from "@/types";

const REMOTION_ENTRY = path.join(process.cwd(), "src", "remotion", "index.ts");
const OUTPUT_DIR = path.join(process.cwd(), "output");

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      surah,
      ayahStart,
      ayahEnd,
      reciterId,
      templateId,
      format = "vertical",
      arabicFont = "amiri-quran",
      wordHighlight = false,
      audioWaveform = false,
      transitionEffect = "none",
      calligraphyEntrance = false,
      dataSource = "local",
    } = body as {
      surah: number;
      ayahStart: number;
      ayahEnd: number;
      reciterId: string;
      templateId: number;
      format?: VideoFormat;
      arabicFont?: ArabicFontId;
      wordHighlight?: boolean;
      audioWaveform?: boolean;
      transitionEffect?: TransitionEffect;
      calligraphyEntrance?: boolean;
      dataSource?: DataSource;
    };

    if (!surah || !ayahStart || !ayahEnd || !reciterId || !templateId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { ayahs, recitations } = await fetchAyahData(surah, ayahStart, ayahEnd, reciterId, dataSource);

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Build timestamps
    let timestamps: AyahTimestamp[];
    let totalDurationMs: number;

    if (dataSource === "local" && isSurahLevelReciter(reciterId)) {
      const surahTimestamps = getSurahLevelTimestamps(reciterId, surah, ayahStart, ayahEnd);
      const firstStart = surahTimestamps[0].startMs;
      const lastEnd = surahTimestamps[surahTimestamps.length - 1].endMs;
      timestamps = surahTimestamps.map((ts) => ({
        ayah: ts.ayah,
        startMs: ts.startMs - firstStart,
        endMs: ts.endMs - firstStart,
      }));
      totalDurationMs = lastEnd - firstStart;
    } else {
      let cumulativeMs = 0;
      timestamps = recitations.map((r) => {
        const lastSeg = r.segments[r.segments.length - 1];
        const ayahDurationMs = lastSeg
          ? parseInt(String(lastSeg[3]), 10)
          : (r.duration > 0 ? r.duration * 1000 : 3000);
        const ts = {
          ayah: r.ayahNumber,
          startMs: cumulativeMs,
          endMs: cumulativeMs + ayahDurationMs,
        };
        cumulativeMs += ayahDurationMs;
        return ts;
      });
      totalDurationMs = cumulativeMs;
    }

    // Build word timings
    const wordTimings: AyahWordTimings[] = recitations.map((r, i) => {
      const ayahStartMs = timestamps[i].startMs;
      const words: [number, number, number, number][] = r.segments.map((seg) => {
        const wordIdx = parseInt(String(seg[0]), 10);
        const wordEnd = parseInt(String(seg[1]), 10);
        const segStartMs = parseInt(String(seg[2]), 10);
        const segEndMs = parseInt(String(seg[3]), 10);
        return [wordIdx, wordEnd, ayahStartMs + segStartMs, ayahStartMs + segEndMs];
      });
      return { ayah: r.ayahNumber, words };
    });

    const totalDurationFrames = Math.ceil((totalDurationMs / 1000) * 30);
    const fontFamily = ARABIC_FONTS.find((f) => f.id === arabicFont)?.family || "Amiri Quran";

    // Render at the midpoint of the first ayah for the thumbnail
    const firstTs = timestamps[0];
    const midpointMs = firstTs.startMs + (firstTs.endMs - firstTs.startMs) / 2;
    const thumbnailFrame = Math.round((midpointMs / 1000) * 30);

    const inputProps: VideoCompositionProps = {
      ayahs,
      timestamps,
      wordTimings,
      audioUrls: [],
      backgroundColor: template.backgroundColor,
      backgroundImage: template.backgroundImage,
      backgroundVideos: [],
      arabicFontSize: template.arabicFontSize,
      translationFontSize: template.translationFontSize,
      arabicColor: template.arabicColor,
      translationColor: template.translationColor,
      arabicFontFamily: fontFamily,
      wordHighlight,
      audioWaveform: false,
      transitionEffect: transitionEffect as TransitionEffect,
      calligraphyEntrance: false,
      surahIntro: false,
      surahMeta: null,
      format: format as VideoFormat,
    };

    const bundled = await bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: path.join(process.cwd(), "public"),
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias || {}),
            "@": path.join(process.cwd(), "src"),
          },
        },
      }),
    });

    const compositionId = `ShortVideo-${format}`;
    const composition = await selectComposition({
      serveUrl: bundled,
      id: compositionId,
      inputProps: inputProps as unknown as Record<string, unknown>,
    });

    composition.durationInFrames = totalDurationFrames;

    const userOutputDir = path.join(OUTPUT_DIR, userId);
    if (!fs.existsSync(userOutputDir)) {
      fs.mkdirSync(userOutputDir, { recursive: true });
    }
    const outputPath = path.join(
      userOutputDir,
      `thumbnail-${surah}-${ayahStart}-${ayahEnd}-${Date.now()}.png`
    );

    await renderStill({
      composition,
      serveUrl: bundled,
      output: outputPath,
      inputProps: inputProps as unknown as Record<string, unknown>,
      frame: Math.min(thumbnailFrame, totalDurationFrames - 1),
    });

    const imageBuffer = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);

    return new Response(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="noorcuts-thumbnail-${surah}-${ayahStart}-${ayahEnd}.png"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Thumbnail generation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
