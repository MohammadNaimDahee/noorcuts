import type { Ayah, AyahRecitation, DataSource, WordSegment } from "@/types";
import { getAyahRange, getRecitations } from "@/lib/quran";
import { getAllVersesByChapter, getRecitationAudioFiles, getChapters } from "@/lib/qf-content";
import type { QfVerse } from "@/lib/qf-content";

/** Strip HTML tags (footnotes etc.) from translation text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** Strip everything except Arabic letters for fuzzy matching */
function arabicCore(s: string): string {
  return s.replace(/[^\u0621-\u064A\u0671-\u06D3]/g, "");
}

/**
 * Build a mapping from QF word index (0-based, spoken words only)
 * to the index in text_uthmani.split(/\s+/).
 * This accounts for pause marks, end markers, etc. that appear as
 * separate tokens in the split text but are not in the QF words array.
 */
function buildWordIndexMap(verse: QfVerse): Map<number, number> {
  const map = new Map<number, number>();
  const qfWords = (verse.words || []).filter((w) => w.char_type_name === "word");
  const arabic = verse.text_uthmani || "";
  // Use unfiltered split to match ShortVideo.tsx which does arabic.split(/\s+/)
  const splitWords = arabic.split(/\s+/);

  let searchFrom = 0;
  for (let qfIdx = 0; qfIdx < qfWords.length; qfIdx++) {
    const qwCore = arabicCore(qfWords[qfIdx].text_uthmani || qfWords[qfIdx].text || "");
    for (let si = searchFrom; si < splitWords.length; si++) {
      const siCore = arabicCore(splitWords[si]);
      if (siCore.length > 0 && qwCore.startsWith(siCore)) {
        map.set(qfIdx, si);
        searchFrom = si + 1;
        break;
      }
    }
  }

  return map;
}

/**
 * Remap segment word indices from QF word positions to text_uthmani split positions.
 * Segments stay as [wordStart, wordEnd, startMs, endMs] but with corrected word indices.
 */
function remapSegments(
  segments: number[][],
  indexMap: Map<number, number>
): WordSegment[] {
  return segments.map((s) => {
    const qfWordIdx = Number(s[0]);
    const mappedIdx = indexMap.get(qfWordIdx);
    if (mappedIdx !== undefined) {
      return [String(mappedIdx), String(mappedIdx + 1), String(s[2]), String(s[3])] as WordSegment;
    }
    // Fallback: keep original index
    return [String(s[0]), String(s[1]), String(s[2]), String(s[3])] as WordSegment;
  });
}

/**
 * Fetches ayah data and recitation info from the appropriate source.
 * Used by render, preview, and thumbnail endpoints.
 */
export async function fetchAyahData(
  surah: number,
  ayahStart: number,
  ayahEnd: number,
  reciterId: string,
  dataSource: DataSource = "local",
  translationId: string = "20"
): Promise<{ ayahs: Ayah[]; recitations: AyahRecitation[] }> {
  if (dataSource === "quran.com") {
    // Map local reciter IDs to QF numeric IDs if needed
    const LOCAL_TO_QF: Record<string, string> = {
      "ayah-recitation-abdur-rahman-as-sudais-recitation": "7",
      "ayah-recitation-mishari-rashid-al-afasy-murattal-hafs-953": "2",
      "ayah-recitation-mishari-rashid-al-afasy-recitation": "2",
      "ayah-recitation-hani-ar-rifai-recitation": "9",
    };
    const qfReciterId = isNaN(Number(reciterId))
      ? (LOCAL_TO_QF[reciterId] || "7")
      : reciterId;

    const [qfVerses, qfChapters] = await Promise.all([
      getAllVersesByChapter(surah, translationId),
      getChapters(),
    ]);
    const chapter = qfChapters.find((c) => c.id === surah);
    const filteredVerses = qfVerses.filter(
      (v) => v.verse_number >= ayahStart && v.verse_number <= ayahEnd
    );
    if (filteredVerses.length === 0) {
      throw new Error(`No ayahs found for surah ${surah}, ayah ${ayahStart}-${ayahEnd}`);
    }
    const ayahs: Ayah[] = filteredVerses.map((v) => {
      const arabic = v.text_uthmani || v.text_imlaei || "";
      const splitWords = arabic.split(/\s+/);
      const indexMap = buildWordIndexMap(v);

      // Build word translations aligned to splitWords positions
      const qfWords = (v.words || []).filter((w) => w.char_type_name === "word");
      const wordTranslations: string[] = new Array(splitWords.length).fill("");
      for (let qi = 0; qi < qfWords.length; qi++) {
        const mappedIdx = indexMap.get(qi);
        if (mappedIdx !== undefined && mappedIdx < splitWords.length) {
          wordTranslations[mappedIdx] = qfWords[qi].translation?.text || "";
        }
      }

      return {
        surah,
        ayah: v.verse_number,
        surahName: chapter?.name_arabic || "",
        surahNameEn: chapter?.name_simple || "",
        arabic,
        translation_en: stripHtml(v.translations?.[0]?.text || ""),
        wordTranslations,
      };
    });

    const qfAudio = await getRecitationAudioFiles(Number(qfReciterId), surah);
    const filteredAudio = qfAudio.filter((a) => {
      const ayahNum = parseInt(a.verse_key.split(":")[1], 10);
      return ayahNum >= ayahStart && ayahNum <= ayahEnd;
    }).sort((a, b) => {
      const ayahA = parseInt(a.verse_key.split(":")[1], 10);
      const ayahB = parseInt(b.verse_key.split(":")[1], 10);
      return ayahA - ayahB;
    });
    if (filteredAudio.length === 0) {
      throw new Error(`No audio found for reciter ${reciterId}, surah ${surah}`);
    }
    const recitations: AyahRecitation[] = await Promise.all(filteredAudio.map(async (a) => {
      const ayahNum = parseInt(a.verse_key.split(":")[1], 10);
      const verse = filteredVerses.find((v) => v.verse_number === ayahNum);
      const indexMap = verse ? buildWordIndexMap(verse) : new Map<number, number>();
      const audioUrl = a.url.startsWith("http") ? a.url : a.url.startsWith("//") ? `https:${a.url}` : `https://audio.qurancdn.com/${a.url}`;

      // Estimate duration from segments, or from Content-Length if no segments
      let duration = 0;
      if (a.segments && a.segments.length > 0) {
        const lastSeg = a.segments[a.segments.length - 1];
        duration = (lastSeg[lastSeg.length - 1] || 0) / 1000;
      } else {
        // No segments — estimate from file size (assuming ~128kbps mp3 = 16KB/s)
        try {
          const headRes = await fetch(audioUrl, { method: "HEAD" });
          const contentLength = parseInt(headRes.headers.get("content-length") || "0", 10);
          if (contentLength > 0) {
            duration = contentLength / 16000; // 128kbps = 16000 bytes/sec
          }
        } catch { /* fallback to 0 */ }
      }

      return {
        surahNumber: surah,
        ayahNumber: ayahNum,
        audioUrl,
        duration,
        segments: remapSegments(a.segments || [], indexMap),
      };
    }));

    return { ayahs, recitations };
  }

  // Local data
  const ayahs = getAyahRange(surah, ayahStart, ayahEnd);
  if (ayahs.length === 0) {
    throw new Error(`No ayahs found for surah ${surah}, ayah ${ayahStart}-${ayahEnd}`);
  }
  const recitations = getRecitations(reciterId, surah, ayahStart, ayahEnd);
  if (recitations.length === 0) {
    throw new Error(`No recitations found for reciter ${reciterId}, surah ${surah}`);
  }

  return { ayahs, recitations };
}
