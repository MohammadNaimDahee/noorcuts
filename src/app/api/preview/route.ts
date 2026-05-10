import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAyahRange,
  getRecitations,
  isSurahLevelReciter,
  getSurahLevelTimestamps,
  getSurahList,
  getSurahRevelationType,
} from "@/lib/quran";
import { getTemplate } from "@/lib/db";
import { ARABIC_FONTS } from "@/types";
import type { AyahTimestamp, AyahWordTimings, VideoFormat, ArabicFontId, TransitionEffect, SurahMeta } from "@/types";

export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const surah = parseInt(searchParams.get("surah") || "0", 10);
  const ayahStart = parseInt(searchParams.get("ayahStart") || "0", 10);
  const ayahEnd = parseInt(searchParams.get("ayahEnd") || "0", 10);
  const reciterId = searchParams.get("reciterId") || "";
  const templateId = parseInt(searchParams.get("templateId") || "1", 10);
  const format = (searchParams.get("format") || "vertical") as VideoFormat;
  const arabicFont = (searchParams.get("arabicFont") || "amiri-quran") as ArabicFontId;
  const wordHighlight = searchParams.get("wordHighlight") === "true";
  const audioWaveform = searchParams.get("audioWaveform") === "true";
  const transitionEffect = (searchParams.get("transitionEffect") || "none") as TransitionEffect;
  const calligraphyEntrance = searchParams.get("calligraphyEntrance") === "true";
  const surahIntro = searchParams.get("surahIntro") === "true";

  if (!surah || !ayahStart || !ayahEnd || !reciterId) {
    return NextResponse.json(
      { error: "Missing required params: surah, ayahStart, ayahEnd, reciterId" },
      { status: 400 }
    );
  }

  try {
    const ayahs = getAyahRange(surah, ayahStart, ayahEnd);
    if (ayahs.length === 0) {
      return NextResponse.json({ error: "No ayahs found" }, { status: 404 });
    }

    const recitations = getRecitations(reciterId, surah, ayahStart, ayahEnd);
    if (recitations.length === 0) {
      return NextResponse.json({ error: "No recitations found" }, { status: 404 });
    }

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    let timestamps: AyahTimestamp[];
    let audioUrls: string[];
    let totalDurationMs: number;

    if (isSurahLevelReciter(reciterId)) {
      const surahTimestamps = getSurahLevelTimestamps(reciterId, surah, ayahStart, ayahEnd);
      const firstStart = surahTimestamps[0].startMs;
      const lastEnd = surahTimestamps[surahTimestamps.length - 1].endMs;

      timestamps = surahTimestamps.map((ts) => ({
        ayah: ts.ayah,
        startMs: ts.startMs - firstStart,
        endMs: ts.endMs - firstStart,
      }));
      totalDurationMs = lastEnd - firstStart;
      // For surah-level, we'd need to extract audio segment — use individual ayah URLs as fallback
      audioUrls = recitations.map((r) => r.audioUrl);
    } else {
      // Ayah-level: build cumulative timestamps from segment data
      let cumulativeMs = 0;
      timestamps = recitations.map((r) => {
        // Use last segment's endMs for precise duration
        const lastSeg = r.segments[r.segments.length - 1];
        const ayahDurationMs = lastSeg ? parseInt(String(lastSeg[3]), 10) : (r.duration * 1000);
        const ts = {
          ayah: r.ayahNumber,
          startMs: cumulativeMs,
          endMs: cumulativeMs + ayahDurationMs,
        };
        cumulativeMs += ayahDurationMs;
        return ts;
      });
      totalDurationMs = cumulativeMs;
      audioUrls = recitations.map((r) => r.audioUrl);
    }

    // Surah intro: shift timestamps forward
    const INTRO_DURATION_MS = 3500;
    let surahMeta: SurahMeta | null = null;
    if (surahIntro) {
      const surahList = getSurahList();
      const surahInfo = surahList.find((s) => s.id === surah);
      surahMeta = {
        name: ayahs[0].surahName,
        nameEn: ayahs[0].surahNameEn,
        totalVerses: surahInfo?.totalVerses || ayahEnd,
        revelationType: getSurahRevelationType(surah),
        introDurationMs: INTRO_DURATION_MS,
      };
      timestamps = timestamps.map((ts) => ({
        ...ts,
        startMs: ts.startMs + INTRO_DURATION_MS,
        endMs: ts.endMs + INTRO_DURATION_MS,
      }));
      totalDurationMs += INTRO_DURATION_MS;
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

    return NextResponse.json({
      ayahs,
      timestamps,
      wordTimings,
      audioUrls,
      totalDurationMs,
      totalDurationFrames,
      backgroundColor: template.backgroundColor,
      backgroundImage: template.backgroundImage,
      arabicFontSize: template.arabicFontSize,
      translationFontSize: template.translationFontSize,
      arabicColor: template.arabicColor,
      translationColor: template.translationColor,
      arabicFontFamily: fontFamily,
      format,
      wordHighlight,
      audioWaveform,
      transitionEffect,
      calligraphyEntrance,
      surahIntro,
      surahMeta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Preview data error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
