import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { Ayah, SurahInfo, AyahRecitation, AyahTimestamp, Reciter, WordSegment } from "@/types";

const QURAN_PATH = path.join(process.cwd(), "data", "quran.json");
const DATA_DIR = path.join(process.cwd(), "data");

let cachedAyahs: Ayah[] | null = null;

export function loadAllAyahs(): Ayah[] {
  if (cachedAyahs) return cachedAyahs;
  const raw = fs.readFileSync(QURAN_PATH, "utf-8");
  cachedAyahs = JSON.parse(raw) as Ayah[];
  return cachedAyahs;
}

export function getAyahsBySurah(surah: number): Ayah[] {
  return loadAllAyahs().filter((a) => a.surah === surah);
}

export function getAyahRange(
  surah: number,
  ayahStart: number,
  ayahEnd: number
): Ayah[] {
  return loadAllAyahs().filter(
    (a) => a.surah === surah && a.ayah >= ayahStart && a.ayah <= ayahEnd
  );
}

export function getSurahList(): SurahInfo[] {
  const ayahs = loadAllAyahs();
  const surahMap = new Map<number, SurahInfo>();

  for (const a of ayahs) {
    if (!surahMap.has(a.surah)) {
      surahMap.set(a.surah, {
        id: a.surah,
        name: a.surahName,
        nameEn: a.surahNameEn,
        totalVerses: 0,
      });
    }
    const info = surahMap.get(a.surah)!;
    info.totalVerses = Math.max(info.totalVerses, a.ayah);
  }

  return Array.from(surahMap.values()).sort((a, b) => a.id - b.id);
}

// --- Reciter DB functions ---

/** Discover all reciter DBs in data/ directory */
export function getReciters(): Reciter[] {
  const files = fs.readdirSync(DATA_DIR);
  return files
    .filter((f) => f.endsWith(".db") && f !== "noorcuts.db")
    .map((f) => {
      const name = f
        .replace(/^ayah-recitation-/, "")
        .replace(/^surah-recitation-/, "")
        .replace(/-recitation\.db$/, "")
        .replace(/\.db$/, "")
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const type = f.startsWith("surah-recitation-") ? "surah" as const : "ayah" as const;
      return {
        id: f.replace(/\.db$/, ""),
        name,
        dbPath: path.join(DATA_DIR, f),
        type,
      };
    });
}

/** Open a reciter DB (read-only) */
function openReciterDb(reciter: Reciter): Database.Database {
  return new Database(reciter.dbPath, { readonly: true });
}

function findReciter(reciterId: string): Reciter {
  const reciters = getReciters();
  const reciter = reciters.find((r) => r.id === reciterId);
  if (!reciter) throw new Error(`Reciter not found: ${reciterId}`);
  return reciter;
}

/** Get recitation data for a range of ayahs from a reciter DB.
 *  Handles both ayah-level DBs (one audio per ayah) and
 *  surah-level DBs (one audio per surah with segment timestamps). */
export function getRecitations(
  reciterId: string,
  surah: number,
  ayahStart: number,
  ayahEnd: number
): AyahRecitation[] {
  const reciter = findReciter(reciterId);
  const db = openReciterDb(reciter);
  try {
    if (reciter.type === "surah") {
      return getSurahLevelRecitations(db, surah, ayahStart, ayahEnd);
    }
    return getAyahLevelRecitations(db, surah, ayahStart, ayahEnd);
  } finally {
    db.close();
  }
}

/** Ayah-level DB: table `verses` with one row per ayah, each with its own audio_url.
 *  Some DBs use per-surah ayah numbers (1,2,3...) while others use global ayah numbers.
 *  We detect this by checking if the surah's min ayah_number matches ayahStart. */
function getAyahLevelRecitations(
  db: Database.Database,
  surah: number,
  ayahStart: number,
  ayahEnd: number
): AyahRecitation[] {
  // First, try with per-surah ayah numbers
  let rows = db
    .prepare(
      `SELECT surah_number, ayah_number, audio_url, duration, segments
       FROM verses
       WHERE surah_number = ? AND ayah_number >= ? AND ayah_number <= ?
       ORDER BY ayah_number`
    )
    .all(surah, ayahStart, ayahEnd) as Array<{
    surah_number: number;
    ayah_number: number;
    audio_url: string;
    duration: number | null;
    segments: string;
  }>;

  // If no results, the DB likely uses global ayah numbers
  if (rows.length === 0) {
    // Get all ayahs for this surah to find the offset
    const surahRows = db
      .prepare(
        `SELECT ayah_number FROM verses WHERE surah_number = ? ORDER BY ayah_number`
      )
      .all(surah) as Array<{ ayah_number: number }>;

    if (surahRows.length > 0) {
      const globalOffset = surahRows[0].ayah_number - 1; // e.g. surah 93 starts at 6080, offset = 6079
      const globalStart = globalOffset + ayahStart;
      const globalEnd = globalOffset + ayahEnd;

      rows = db
        .prepare(
          `SELECT surah_number, ayah_number, audio_url, duration, segments
           FROM verses
           WHERE surah_number = ? AND ayah_number >= ? AND ayah_number <= ?
           ORDER BY ayah_number`
        )
        .all(surah, globalStart, globalEnd) as typeof rows;
    }
  }

  // Determine if numbering is global by checking if first ayah_number > ayahStart
  const usesGlobalNumbering = rows.length > 0 && rows[0].ayah_number !== ayahStart;
  const globalOffset = usesGlobalNumbering && rows.length > 0
    ? rows[0].ayah_number - ayahStart
    : 0;

  return rows.map((row) => ({
    surahNumber: row.surah_number,
    ayahNumber: row.ayah_number - globalOffset, // Normalize to per-surah numbering
    audioUrl: row.audio_url,
    duration: row.duration ?? 0,
    segments: JSON.parse(row.segments) as WordSegment[],
  }));
}

/** Surah-level DB: table `surah_list` for audio URL, table `segments` for per-ayah timing.
 *  Segments have absolute timestamps within the surah audio file.
 *  Schema: segments(surah_number, ayah_number, duration_sec, timestamp_from, timestamp_to, segments)
 *  segments column: [[wordIndex, startMs, endMs], ...] */
function getSurahLevelRecitations(
  db: Database.Database,
  surah: number,
  ayahStart: number,
  ayahEnd: number
): AyahRecitation[] {
  // Get surah audio URL
  const surahRow = db
    .prepare("SELECT audio_url, duration FROM surah_list WHERE surah_number = ?")
    .get(surah) as { audio_url: string; duration: number } | undefined;
  if (!surahRow) throw new Error(`Surah ${surah} not found in reciter DB`);

  // Get ayah segments
  const segRows = db
    .prepare(
      `SELECT surah_number, ayah_number, duration_sec, timestamp_from, timestamp_to, segments
       FROM segments
       WHERE surah_number = ? AND ayah_number >= ? AND ayah_number <= ?
       ORDER BY ayah_number`
    )
    .all(surah, ayahStart, ayahEnd) as Array<{
    surah_number: number;
    ayah_number: number;
    duration_sec: number;
    timestamp_from: number;
    timestamp_to: number;
    segments: string;
  }>;

  return segRows.map((row) => {
    // Convert surah-level segments [[wordIndex, startMs, endMs], ...]
    // to ayah-level format [wordStart, wordEnd, startMs, endMs]
    const rawSegments = JSON.parse(row.segments) as Array<[number, number, number]>;
    const wordSegments: WordSegment[] = rawSegments.map((s, i) => [
      String(i),
      String(i + 1),
      String(s[1]),
      String(s[2]),
    ]);

    return {
      surahNumber: row.surah_number,
      ayahNumber: row.ayah_number,
      audioUrl: surahRow.audio_url, // Same audio URL for all ayahs
      duration: row.duration_sec,
      segments: wordSegments,
      // Extra fields for surah-level timing
      _timestampFrom: row.timestamp_from,
      _timestampTo: row.timestamp_to,
    } as AyahRecitation;
  });
}

/** Check if a reciter uses surah-level audio (single file per surah) */
export function isSurahLevelReciter(reciterId: string): boolean {
  return findReciter(reciterId).type === "surah";
}

/** For surah-level reciters, get the absolute timestamp offsets within the surah audio */
export function getSurahLevelTimestamps(
  reciterId: string,
  surah: number,
  ayahStart: number,
  ayahEnd: number
): AyahTimestamp[] {
  const reciter = findReciter(reciterId);
  const db = openReciterDb(reciter);
  try {
    const rows = db
      .prepare(
        `SELECT ayah_number, timestamp_from, timestamp_to
         FROM segments
         WHERE surah_number = ? AND ayah_number >= ? AND ayah_number <= ?
         ORDER BY ayah_number`
      )
      .all(surah, ayahStart, ayahEnd) as Array<{
      ayah_number: number;
      timestamp_from: number;
      timestamp_to: number;
    }>;

    return rows.map((row) => ({
      ayah: row.ayah_number,
      startMs: row.timestamp_from,
      endMs: row.timestamp_to,
    }));
  } finally {
    db.close();
  }
}

/** Get the surah audio URL for a surah-level reciter */
export function getSurahAudioUrl(reciterId: string, surah: number): string {
  const reciter = findReciter(reciterId);
  const db = openReciterDb(reciter);
  try {
    const row = db
      .prepare("SELECT audio_url FROM surah_list WHERE surah_number = ?")
      .get(surah) as { audio_url: string } | undefined;
    if (!row) throw new Error(`Surah ${surah} not found in reciter DB`);
    return row.audio_url;
  } finally {
    db.close();
  }
}

/** Convert recitations to simple ayah-level timestamps with cumulative offsets
 *  (used when stitching multiple ayah audios into one video).
 *  Uses the last word segment's endMs for precise duration rather than
 *  the rounded integer `duration` field. */
export function recitationsToTimestamps(
  recitations: AyahRecitation[]
): AyahTimestamp[] {
  let cumulativeMs = 0;
  return recitations.map((r) => {
    // Get precise duration from the last segment's endMs
    const lastSegment = r.segments[r.segments.length - 1];
    const durationMs = lastSegment
      ? parseInt(lastSegment[3], 10)
      : r.duration * 1000;
    const ts: AyahTimestamp = {
      ayah: r.ayahNumber,
      startMs: cumulativeMs,
      endMs: cumulativeMs + durationMs,
    };
    cumulativeMs += durationMs;
    return ts;
  });
}
