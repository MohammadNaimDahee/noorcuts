import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getRecitations,
  isSurahLevelReciter,
  getSurahLevelTimestamps,
  getSurahList,
} from "@/lib/quran";

export interface ClipSuggestion {
  ayahStart: number;
  ayahEnd: number;
  durationMs: number;
  durationLabel: string;
  reason: string;
}

/**
 * GET /api/autoclip?surah=1&reciterId=...&minSeconds=30&maxSeconds=60
 *
 * Finds optimal ayah ranges that fit within the target duration window.
 * Uses actual recitation durations from the reciter DB for accuracy.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const surah = parseInt(searchParams.get("surah") || "0", 10);
  const reciterId = searchParams.get("reciterId") || "";
  const minSeconds = parseInt(searchParams.get("minSeconds") || "25", 10);
  const maxSeconds = parseInt(searchParams.get("maxSeconds") || "60", 10);

  if (!surah || !reciterId) {
    return NextResponse.json(
      { error: "Missing required params: surah, reciterId" },
      { status: 400 }
    );
  }

  try {
    const surahList = getSurahList();
    const surahInfo = surahList.find((s) => s.id === surah);
    if (!surahInfo) {
      return NextResponse.json({ error: "Surah not found" }, { status: 404 });
    }

    const totalAyahs = surahInfo.totalVerses;

    // Get all recitations for the entire surah to compute durations
    const recitations = getRecitations(reciterId, surah, 1, totalAyahs);
    if (recitations.length === 0) {
      return NextResponse.json({ error: "No recitations found" }, { status: 404 });
    }

    // Build ayah durations
    let ayahDurations: { ayah: number; durationMs: number }[];

    if (isSurahLevelReciter(reciterId)) {
      const timestamps = getSurahLevelTimestamps(reciterId, surah, 1, totalAyahs);
      ayahDurations = timestamps.map((ts) => ({
        ayah: ts.ayah,
        durationMs: ts.endMs - ts.startMs,
      }));
    } else {
      ayahDurations = recitations.map((r) => {
        const lastSeg = r.segments[r.segments.length - 1];
        const durationMs = lastSeg ? parseInt(String(lastSeg[3]), 10) : r.duration * 1000;
        return { ayah: r.ayahNumber, durationMs };
      });
    }

    const minMs = minSeconds * 1000;
    const maxMs = maxSeconds * 1000;
    const suggestions: ClipSuggestion[] = [];

    // Sliding window approach: find all contiguous ranges that fit within duration window
    for (let start = 0; start < ayahDurations.length; start++) {
      let totalMs = 0;
      for (let end = start; end < ayahDurations.length; end++) {
        totalMs += ayahDurations[end].durationMs;

        if (totalMs > maxMs) break;

        if (totalMs >= minMs && totalMs <= maxMs) {
          const ayahCount = end - start + 1;
          const durationSec = Math.round(totalMs / 1000);
          const minutes = Math.floor(durationSec / 60);
          const seconds = durationSec % 60;
          const durationLabel = minutes > 0
            ? `${minutes}m ${seconds}s`
            : `${seconds}s`;

          // Score the clip: prefer clips starting at ayah 1, longer clips, and natural boundaries
          let reason = `${ayahCount} ayah${ayahCount > 1 ? "s" : ""}`;
          if (ayahDurations[start].ayah === 1) {
            reason += " (from beginning)";
          }
          if (end === ayahDurations.length - 1) {
            reason += " (to end)";
          }

          suggestions.push({
            ayahStart: ayahDurations[start].ayah,
            ayahEnd: ayahDurations[end].ayah,
            durationMs: totalMs,
            durationLabel,
            reason,
          });
        }
      }
    }

    // Sort: prefer clips from beginning, then by closeness to target duration center
    const targetCenter = (minMs + maxMs) / 2;
    suggestions.sort((a, b) => {
      // Boost clips starting from ayah 1
      const aFromStart = a.ayahStart === 1 ? -10000 : 0;
      const bFromStart = b.ayahStart === 1 ? -10000 : 0;
      // Then by closeness to target center
      const aDist = Math.abs(a.durationMs - targetCenter);
      const bDist = Math.abs(b.durationMs - targetCenter);
      return (aFromStart + aDist) - (bFromStart + bDist);
    });

    // Return top 10 suggestions
    return NextResponse.json(suggestions.slice(0, 10));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auto-clip error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
