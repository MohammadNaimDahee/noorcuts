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
import type { VideoCompositionProps, VideoFormat, AyahTimestamp, AyahWordTimings, BackgroundVideo, ArabicFontId, TransitionEffect } from "@/types";
import { ARABIC_FONTS } from "@/types";
import { updateRenderProgress } from "@/lib/render-progress";

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
  wordHighlight: boolean = false,
  audioWaveform: boolean = false,
  transitionEffect: TransitionEffect = "none",
  calligraphyEntrance: boolean = false,
  userId: string,
  projectId?: number,
  onProgress?: RenderProgressCallback
): Promise<{ jobId: number; outputPath: string }> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jobId = createRenderJob(surah, ayahStart, ayahEnd, reciterId, templateId, userId, projectId);
  updateRenderJob(jobId, { status: "rendering" });
  updateRenderProgress(jobId, { stage: "Starting", progress: 0, status: "rendering", jobId });

  const emitProgress = (stage: string, progress: number) => {
    updateRenderProgress(jobId, { stage, progress, status: "rendering" });
    onProgress?.(stage, progress);
  };

  const jobTempDir = path.join(TEMP_DIR, `job-${jobId}`);
  const bgVideoPublicDir = path.join(process.cwd(), "public", "temp-bg", `job-${jobId}`);

  try {
    // Gather data
    emitProgress("Gathering ayah data", 0);
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
      emitProgress("Downloading audio", 5);
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
      emitProgress("Downloading audio", 5);
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

    // Build word-level timings (absolute ms relative to full timeline)
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

    // Download background videos if provided
    // Videos must be in public/ so Remotion can serve them via staticFile()
    const bgVideoStaticPaths: string[] = [];
    if (backgroundVideos.length > 0) {
      emitProgress("Downloading background videos", 15);
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
      wordTimings,
      audioUrls: [],
      backgroundColor: template.backgroundColor,
      backgroundImage: template.backgroundImage,
      backgroundVideos: bgVideoStaticPaths,
      arabicFontSize: template.arabicFontSize,
      translationFontSize: template.translationFontSize,
      arabicColor: template.arabicColor,
      translationColor: template.translationColor,
      arabicFontFamily: ARABIC_FONTS.find((f) => f.id === arabicFont)?.family || "Amiri Quran",
      wordHighlight,
      audioWaveform,
      transitionEffect,
      calligraphyEntrance,
      format,
    };

    // Bundle and render video (without audio)
    emitProgress("Bundling composition", 25);
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

    emitProgress("Rendering video", 35);
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
        emitProgress("Rendering video", pct);
      },
    });

    // Mux audio onto the silent video
    emitProgress("Muxing audio", 92);
    const userOutputDir = path.join(OUTPUT_DIR, userId);
    if (!fs.existsSync(userOutputDir)) {
      fs.mkdirSync(userOutputDir, { recursive: true });
    }
    const finalOutputPath = path.join(
      userOutputDir,
      `noorcuts-${surah}-${ayahStart}-${ayahEnd}-${jobId}.mp4`
    );
    await muxAudio(silentVideoPath, concatAudioPath, finalOutputPath);

    cleanupTempDir(jobTempDir);
    cleanupTempDir(bgVideoPublicDir);

    emitProgress("Complete", 100);
    updateRenderProgress(jobId, { status: "completed", progress: 100, stage: "Complete" });
    updateRenderJob(jobId, { status: "completed", outputPath: finalOutputPath });
    return { jobId, outputPath: finalOutputPath };
  } catch (err) {
    cleanupTempDir(jobTempDir);
    cleanupTempDir(bgVideoPublicDir);
    const message = err instanceof Error ? err.message : "Unknown render error";
    updateRenderProgress(jobId, { status: "failed", error: message, stage: "Failed" });
    updateRenderJob(jobId, { status: "failed", errorMessage: message });
    throw err;
  }
}
