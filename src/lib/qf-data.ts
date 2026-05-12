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
  dataSource: DataSource = "local"
): Promise<{ ayahs: Ayah[]; recitations: AyahRecitation[] }> {
  if (dataSource === "quran.com") {
    const [qfVerses, qfChapters] = await Promise.all([
      getAllVersesByChapter(surah, "20"),
      getChapters(),
    ]);
    const chapter = qfChapters.find((c) => c.id === surah);
    const filteredVerses = qfVerses.filter(
      (v) => v.verse_number >= ayahStart && v.verse_number <= ayahEnd
    );
    if (filteredVerses.length === 0) {
      throw new Error(`No ayahs found for surah ${surah}, ayah ${ayahStart}-${ayahEnd}`);
    }
    const ayahs: Ayah[] = filteredVerses.map((v) => ({
      surah,
      ayah: v.verse_number,
      surahName: chapter?.name_arabic || "",
      surahNameEn: chapter?.name_simple || "",
      arabic: v.text_uthmani || v.text_imlaei || "",
      translation_en: stripHtml(v.translations?.[0]?.text || ""),
    }));

    const qfAudio = await getRecitationAudioFiles(Number(reciterId), surah);
    const filteredAudio = qfAudio.filter((a) => {
      const ayahNum = parseInt(a.verse_key.split(":")[1], 10);
      return ayahNum >= ayahStart && ayahNum <= ayahEnd;
    });
    if (filteredAudio.length === 0) {
      throw new Error(`No audio found for reciter ${reciterId}, surah ${surah}`);
    }
    const recitations: AyahRecitation[] = filteredAudio.map((a) => {
      const ayahNum = parseInt(a.verse_key.split(":")[1], 10);
      const verse = filteredVerses.find((v) => v.verse_number === ayahNum);
      const indexMap = verse ? buildWordIndexMap(verse) : new Map<number, number>();

      return {
        surahNumber: surah,
        ayahNumber: ayahNum,
        audioUrl: a.url.startsWith("http") ? a.url : `https://audio.qurancdn.com/${a.url}`,
        duration: 0,
        segments: remapSegments(a.segments || [], indexMap),
      };
    });

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
