export interface Ayah {
  surah: number;
  ayah: number;
  surahName: string;
  surahNameEn: string;
  arabic: string;
  translation_en: string;
  /** Word-by-word English translations, aligned to arabic.split(/\s+/) positions */
  wordTranslations?: string[];
}

export interface AyahTimestamp {
  ayah: number;
  startMs: number;
  endMs: number;
}

/** Word-level timing segment from reciter DB: [wordIndex, endWordIndex, startMs, endMs] */
export type WordSegment = [string, string, string, string];

export interface AyahRecitation {
  surahNumber: number;
  ayahNumber: number;
  audioUrl: string;
  duration: number; // seconds
  segments: WordSegment[];
}

export interface Reciter {
  id: string;
  name: string;
  dbPath: string;
  type: "ayah" | "surah";
}

export interface Template {
  id: number;
  name: string;
  backgroundType: "color" | "image";
  backgroundColor: string;
  backgroundImage: string | null;
  arabicFontSize: number;
  translationFontSize: number;
  arabicColor: string;
  translationColor: string;
  createdAt: string;
}

export interface RenderJob {
  id: number;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterId: string;
  templateId: number;
  status: "pending" | "rendering" | "completed" | "failed" | "expired" | "cancelled";
  outputPath: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  projectId: number | null;
  expiresAt: string | null;
}

export type VideoFormat = "vertical" | "horizontal" | "square";

export interface VideoFormatConfig {
  width: number;
  height: number;
  label: string;
}

export const VIDEO_FORMATS: Record<VideoFormat, VideoFormatConfig> = {
  vertical: { width: 1080, height: 1920, label: "Vertical 9:16 (Shorts/Reels)" },
  horizontal: { width: 1920, height: 1080, label: "Horizontal 16:9 (YouTube)" },
  square: { width: 1080, height: 1080, label: "Square 1:1 (Instagram)" },
};

export interface BackgroundVideo {
  id: string;
  url: string; // Pexels video URL (HD or SD)
  thumbnailUrl: string;
  duration: number; // seconds
  width: number;
  height: number;
}

export type ArabicFontId = "amiri-quran" | "scheherazade" | "noto-naskh" | "reem-kufi" | "lateef";

export interface ArabicFontConfig {
  id: ArabicFontId;
  label: string;
  family: string;
  file: string; // filename in public/fonts/
  sampleText: string;
}

export const ARABIC_FONTS: ArabicFontConfig[] = [
  { id: "amiri-quran", label: "Amiri Quran", family: "Amiri Quran", file: "AmiriQuran-Regular.ttf", sampleText: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ" },
  { id: "scheherazade", label: "Scheherazade", family: "Scheherazade New", file: "ScheherazadeNew-Regular.ttf", sampleText: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ" },
  { id: "noto-naskh", label: "Noto Naskh", family: "Noto Naskh Arabic", file: "NotoNaskhArabic-Regular.ttf", sampleText: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ" },
  { id: "reem-kufi", label: "Reem Kufi", family: "Reem Kufi", file: "ReemKufi-Regular.ttf", sampleText: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ" },
  { id: "lateef", label: "Lateef", family: "Lateef", file: "Lateef-Regular.ttf", sampleText: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ" },
];

export type TransitionEffect = "none" | "crossfade" | "slide" | "zoom";

export interface RenderRequest {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterId: string;
  templateId: number;
  format: VideoFormat;
  backgroundVideos?: BackgroundVideo[];
  backgroundImages?: { id: string; url: string }[];
  arabicFont?: ArabicFontId;
  wordHighlight?: boolean;
  audioWaveform?: boolean;
  transitionEffect?: TransitionEffect;
  calligraphyEntrance?: boolean;
  surahIntro?: boolean;
  arabicFontSize?: number;
  translationFontSize?: number;
  translationId?: string;
  overlayOpacity?: number;
  customTranslations?: Record<number, string>;
  projectId?: number;
  dataSource?: DataSource;
}

export type DataSource = "local" | "quran.com";

export interface Project {
  id: number;
  userId: string;
  name: string;
  description: string;
  dataSource: DataSource;
  surah: number | null;
  ayahStart: number | null;
  ayahEnd: number | null;
  reciterId: string | null;
  templateId: number | null;
  format: string;
  arabicFont: string;
  wordHighlight: boolean;
  audioWaveform: boolean;
  transitionEffect: TransitionEffect;
  calligraphyEntrance: boolean;
  surahIntro: boolean;
  translationId: string | null;
  arabicFontSize: number | null;
  translationFontSize: number | null;
  backgroundVideos: string | null; // JSON string of BackgroundVideo[]
  backgroundImages: string | null; // JSON string of {id,url,thumbnailUrl}[]
  overlayOpacity: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Word-level timing for a single ayah, with times relative to the full video timeline */
export interface AyahWordTimings {
  ayah: number;
  /** Each entry: [wordIndex, wordEndIndex, absoluteStartMs, absoluteEndMs] */
  words: [number, number, number, number][];
}

export interface VideoCompositionProps {
  ayahs: Ayah[];
  timestamps: AyahTimestamp[];
  wordTimings: AyahWordTimings[]; // word-level timing per ayah (parallel to ayahs/timestamps)
  audioUrls: string[];
  backgroundColor: string;
  backgroundImage: string | null;
  backgroundImages: string[]; // local file paths to background images (sequential slideshow)
  backgroundVideos: string[]; // local file paths to background video clips (sequential playlist)
  /** Direct URLs for preview (bypass staticFile) */
  backgroundImageUrls?: string[];
  backgroundVideoUrls?: string[];
  /** Durations in seconds for each background video (parallel to backgroundVideos/backgroundVideoUrls) */
  backgroundVideoDurations?: number[];
  arabicFontSize: number;
  translationFontSize: number;
  arabicColor: string;
  translationColor: string;
  arabicFontFamily: string; // CSS font-family for Arabic text
  wordHighlight: boolean; // enable word-by-word highlight
  audioWaveform: boolean; // enable audio waveform visualizer
  transitionEffect: TransitionEffect; // transition between ayahs
  calligraphyEntrance: boolean; // animated calligraphy entrance
  surahIntro: boolean; // cinematic surah intro card
  surahMeta: SurahMeta | null; // metadata for intro card
  format: VideoFormat;
  overlayOpacity?: number; // 0-100, controls background overlay darkness
}

export type RevelationType = "meccan" | "medinan";

export interface SurahMeta {
  name: string; // Arabic surah name
  nameEn: string; // English surah name
  totalVerses: number;
  revelationType: RevelationType;
  introDurationMs: number; // how long the intro card lasts
}

export interface SurahInfo {
  id: number;
  name: string;
  nameEn: string;
  totalVerses: number;
}
