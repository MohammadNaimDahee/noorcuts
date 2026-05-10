import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  getAyahRange,
  getRecitations,
  isSurahLevelReciter,
  getSurahLevelTimestamps,
  getSurahAudioUrl,
} from "@/lib/quran";
import { getTemplate, createRenderJob, updateRenderJob } from "@/lib/db";
import {
  downloadAndConcatAudio,
  downloadFile,
  extractAudioSegment,
  muxAudio,
  cleanupTempDir,
} from "@/lib/ffmpeg";
import type { VideoCompositionProps, VideoFormat, AyahTimestamp, BackgroundVideo, ArabicFontId } from "@/types";
import { ARABIC_FONTS } from "@/types";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const TEMP_DIR = path.join(process.cwd(), "output", ".tmp");
const REMOTION_ENTRY = path.join(process.cwd(), "src", "remotion", "index.ts");

export type RenderProgressCallback = (stage: string, progress: number) => void;

export async function triggerRender(
  surah: number,
  ayahStart: number,
  ayahEnd: number,
  reciterId: string,
  templateId: number,
  format: VideoFormat = "vertical",
  backgroundVideos: BackgroundVideo[] = [],
  arabicFont: ArabicFontId = "amiri-quran",
  userId: string,
  onProgress?: RenderProgressCallback
): Promise<{ jobId: number; outputPath: string }> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jobId = createRenderJob(surah, ayahStart, ayahEnd, reciterId, templateId, userId);
  updateRenderJob(jobId, { status: "rendering" });

  const jobTempDir = path.join(TEMP_DIR, `job-${jobId}`);
  const bgVideoPublicDir = path.join(process.cwd(), "public", "temp-bg", `job-${jobId}`);

  try {
    // Gather data
    onProgress?.("Gathering ayah data", 0);
    const ayahs = getAyahRange(surah, ayahStart, ayahEnd);
    if (ayahs.length === 0) {
      throw new Error(`No ayahs found for surah ${surah}, ayah ${ayahStart}-${ayahEnd}`);
    }

    const recitations = getRecitations(reciterId, surah, ayahStart, ayahEnd);
    if (recitations.length === 0) {
      throw new Error(`No recitations found for reciter ${reciterId}, surah ${surah}`);
    }

    const template = getTemplate(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    let timestamps: AyahTimestamp[];
    let totalDurationMs: number;
    const concatAudioPath = path.join(jobTempDir, "audio.mp3");

    if (isSurahLevelReciter(reciterId)) {
      // Surah-level reciter: one audio file, extract the relevant portion
      onProgress?.("Downloading audio", 5);
      const surahTimestamps = getSurahLevelTimestamps(reciterId, surah, ayahStart, ayahEnd);
      const firstStart = surahTimestamps[0].startMs;
      const lastEnd = surahTimestamps[surahTimestamps.length - 1].endMs;

      // Download full surah audio
      const audioUrl = getSurahAudioUrl(reciterId, surah);
      const fullAudioPath = path.join(jobTempDir, "surah-full.mp3");
      if (!fs.existsSync(jobTempDir)) fs.mkdirSync(jobTempDir, { recursive: true });
      await downloadFile(audioUrl, fullAudioPath);

      // Extract just the relevant portion
      await extractAudioSegment(fullAudioPath, concatAudioPath, firstStart, lastEnd);

      // Adjust timestamps to be relative to the extracted audio (starting from 0)
      timestamps = surahTimestamps.map((ts) => ({
        ayah: ts.ayah,
        startMs: ts.startMs - firstStart,
        endMs: ts.endMs - firstStart,
      }));
      totalDurationMs = lastEnd - firstStart;
    } else {
      // Ayah-level reciter: one audio file per ayah, download and concatenate
      onProgress?.("Downloading audio", 5);
      const audioUrls = recitations.map((r) => r.audioUrl);
      const { durationsMs } = await downloadAndConcatAudio(audioUrls, concatAudioPath, jobTempDir);

      let cumulativeMs = 0;
      timestamps = recitations.map((r, i) => {
        const ts = {
          ayah: r.ayahNumber,
          startMs: cumulativeMs,
          endMs: cumulativeMs + durationsMs[i],
        };
        cumulativeMs += durationsMs[i];
        return ts;
      });
      totalDurationMs = cumulativeMs;
    }

    const totalDurationFrames = Math.ceil((totalDurationMs / 1000) * 30);

    // Download background videos if provided
    // Videos must be in public/ so Remotion can serve them via staticFile()
    const bgVideoStaticPaths: string[] = [];
    if (backgroundVideos.length > 0) {
      onProgress?.("Downloading background videos", 15);
      fs.mkdirSync(bgVideoPublicDir, { recursive: true });
      for (let i = 0; i < backgroundVideos.length; i++) {
        const bgVideo = backgroundVideos[i];
        const filename = `bg-video-${i}.mp4`;
        const localPath = path.join(bgVideoPublicDir, filename);
        await downloadFile(bgVideo.url, localPath);
        // staticFile() paths are relative to public/
        bgVideoStaticPaths.push(`temp-bg/job-${jobId}/${filename}`);
      }
    }

    // Build input props (no audio in composition - we mux it later)
    const inputProps: VideoCompositionProps = {
      ayahs,
      timestamps,
      audioUrls: [],
      backgroundColor: template.backgroundColor,
      backgroundImage: template.backgroundImage,
      backgroundVideos: bgVideoStaticPaths,
      arabicFontSize: template.arabicFontSize,
      translationFontSize: template.translationFontSize,
      arabicColor: template.arabicColor,
      translationColor: template.translationColor,
      arabicFontFamily: ARABIC_FONTS.find((f) => f.id === arabicFont)?.family || "Amiri Quran",
      format,
    };

    // Bundle and render video (without audio)
    onProgress?.("Bundling composition", 25);
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

    onProgress?.("Rendering video", 35);
    const silentVideoPath = path.join(jobTempDir, "video-silent.mp4");
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: silentVideoPath,
      inputProps: inputProps as unknown as Record<string, unknown>,
      onProgress: ({ progress }) => {
        // Rendering is 35-90% of total progress
        const pct = 35 + Math.round(progress * 55);
        onProgress?.("Rendering video", pct);
      },
    });

    // Mux audio onto the silent video
    onProgress?.("Muxing audio", 92);
    const finalOutputPath = path.join(
      OUTPUT_DIR,
      `noorcuts-${surah}-${ayahStart}-${ayahEnd}.mp4`
    );
    await muxAudio(silentVideoPath, concatAudioPath, finalOutputPath);

    cleanupTempDir(jobTempDir);
    cleanupTempDir(bgVideoPublicDir);

    onProgress?.("Complete", 100);
    updateRenderJob(jobId, { status: "completed", outputPath: finalOutputPath });
    return { jobId, outputPath: finalOutputPath };
  } catch (err) {
    cleanupTempDir(jobTempDir);
    cleanupTempDir(bgVideoPublicDir);
    const message = err instanceof Error ? err.message : "Unknown render error";
    updateRenderJob(jobId, { status: "failed", errorMessage: message });
    throw err;
  }
}
