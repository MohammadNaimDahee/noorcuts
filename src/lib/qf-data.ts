import type { Ayah, AyahRecitation, DataSource } from "@/types";
import { getAyahRange, getRecitations } from "@/lib/quran";
import { getAllVersesByChapter, getRecitationAudioFiles, getChapters } from "@/lib/qf-content";

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
      getAllVersesByChapter(surah, "131"),
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
      translation_en: v.translations?.[0]?.text || "",
    }));

    const qfAudio = await getRecitationAudioFiles(Number(reciterId), surah);
    const filteredAudio = qfAudio.filter((a) => {
      const ayahNum = parseInt(a.verse_key.split(":")[1], 10);
      return ayahNum >= ayahStart && ayahNum <= ayahEnd;
    });
    if (filteredAudio.length === 0) {
      throw new Error(`No audio found for reciter ${reciterId}, surah ${surah}`);
    }
    const recitations: AyahRecitation[] = filteredAudio.map((a) => ({
      surahNumber: surah,
      ayahNumber: parseInt(a.verse_key.split(":")[1], 10),
      audioUrl: a.url.startsWith("http") ? a.url : `https://audio.qurancdn.com/${a.url}`,
      duration: 0,
      segments: [],
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
