import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function compressVideo(
  inputPath: string,
  outputPath: string
): Promise<string> {
  await execFileAsync("ffmpeg", [
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ]);
  return outputPath;
}

/** Mux a separate audio file onto a video (replacing any existing audio) */
export async function muxAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<string> {
  await execFileAsync("ffmpeg", [
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ]);
  return outputPath;
}

/** Download a file from a URL to a local path */
export async function downloadFile(
  url: string,
  destPath: string
): Promise<void> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const stream = fs.createWriteStream(destPath);
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve();
        });
        stream.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Extract a segment of audio between startMs and endMs */
export async function extractAudioSegment(
  inputPath: string,
  outputPath: string,
  startMs: number,
  endMs: number
): Promise<string> {
  const startSec = (startMs / 1000).toFixed(3);
  const durationSec = ((endMs - startMs) / 1000).toFixed(3);
  await execFileAsync("ffmpeg", [
    "-i",
    inputPath,
    "-ss",
    startSec,
    "-t",
    durationSec,
    "-c",
    "copy",
    "-y",
    outputPath,
  ]);
  return outputPath;
}

/** Download multiple ayah audio files, concatenate into one MP3,
 *  and return the exact per-file durations (ms) from ffprobe */
export async function downloadAndConcatAudio(
  audioUrls: string[],
  outputPath: string,
  tempDir: string
): Promise<{ outputPath: string; durationsMs: number[] }> {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Download all audio files in parallel
  const localPaths: string[] = [];
  const downloadPromises = audioUrls.map((url, i) => {
    const localPath = path.join(tempDir, `ayah-${i}.mp3`);
    localPaths.push(localPath);
    return downloadFile(url, localPath);
  });
  await Promise.all(downloadPromises);

  // Get exact duration for each file via ffprobe (parallel)
  const durationsMs = await Promise.all(localPaths.map((p) => getAudioDurationMs(p)));

  if (localPaths.length === 1) {
    fs.copyFileSync(localPaths[0], outputPath);
    return { outputPath, durationsMs };
  }

  // Create FFmpeg concat list file
  const listPath = path.join(tempDir, "concat-list.txt");
  const listContent = localPaths
    .map((p) => `file '${p}'`)
    .join("\n");
  fs.writeFileSync(listPath, listContent);

  // Concatenate with FFmpeg
  await execFileAsync("ffmpeg", [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    "-y",
    outputPath,
  ]);

  return { outputPath, durationsMs };
}

/** Clean up a temp directory */
export function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/** Prepend silence to an audio file */
export async function prependSilence(
  inputPath: string,
  outputPath: string,
  silenceMs: number
): Promise<string> {
  const silenceSec = (silenceMs / 1000).toFixed(3);
  await execFileAsync("ffmpeg", [
    "-f", "lavfi",
    "-t", silenceSec,
    "-i", "anullsrc=r=44100:cl=stereo",
    "-i", inputPath,
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
    "-map", "[out]",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-y",
    outputPath,
  ]);
  return outputPath;
}

export async function getAudioDurationMs(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  return Math.round(parseFloat(stdout.trim()) * 1000);
}
