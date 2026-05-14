"use client";

import React, { useEffect, useState, useRef } from "react";
import { Player } from "@remotion/player";
import { ShortVideo } from "@/remotion/ShortVideo";
import { VIDEO_FORMATS } from "@/types";
import type { VideoCompositionProps, VideoFormat, ArabicFontId, TransitionEffect, DataSource } from "@/types";

interface PreviewPlayerProps {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterId: string;
  templateId: number;
  format: VideoFormat;
  arabicFont: ArabicFontId;
  wordHighlight?: boolean;
  audioWaveform?: boolean;
  transitionEffect?: TransitionEffect;
  calligraphyEntrance?: boolean;
  surahIntro?: boolean;
  backgroundVideos?: string[];
  backgroundVideoUrls?: string[];
  backgroundVideoDurations?: number[];
  backgroundImageUrls?: string[];
  arabicFontSizeOverride?: number | null;
  translationFontSizeOverride?: number | null;
  translationId?: string;
  dataSource?: DataSource;
}

interface PreviewData {
  props: VideoCompositionProps;
  totalDurationFrames: number;
}

export function PreviewPlayer({
  surah,
  ayahStart,
  ayahEnd,
  reciterId,
  templateId,
  format,
  arabicFont,
  wordHighlight = false,
  audioWaveform = false,
  transitionEffect = "none",
  calligraphyEntrance = false,
  surahIntro = false,
  backgroundVideos = [],
  backgroundVideoUrls = [],
  backgroundVideoDurations = [],
  backgroundImageUrls = [],
  arabicFontSizeOverride = null,
  translationFontSizeOverride = null,
  translationId = "20",
  dataSource = "local",
}: PreviewPlayerProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bgVideosRef = useRef(backgroundVideos);
  bgVideosRef.current = backgroundVideos;
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedOnce = useRef(false);

  const fetchKey = `${surah}-${ayahStart}-${ayahEnd}-${reciterId}-${templateId}-${format}-${arabicFont}-${wordHighlight}-${audioWaveform}-${transitionEffect}-${calligraphyEntrance}-${surahIntro}-${dataSource}-${translationId}-${backgroundImageUrls.join(",")}-${backgroundVideoUrls.join(",")}-${arabicFontSizeOverride}-${translationFontSizeOverride}`;

  useEffect(() => {
    if (!surah || !ayahStart || !ayahEnd || !reciterId) return;

    // Debounce: wait 500ms after last change before fetching
    // (instant on first load)
    const delay = hasFetchedOnce.current ? 500 : 0;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      if (!hasFetchedOnce.current) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          surah: String(surah),
          ayahStart: String(ayahStart),
          ayahEnd: String(ayahEnd),
          reciterId,
          templateId: String(templateId),
          format,
          arabicFont,
          wordHighlight: String(wordHighlight),
          audioWaveform: String(audioWaveform),
          transitionEffect,
          calligraphyEntrance: String(calligraphyEntrance),
          surahIntro: String(surahIntro),
          dataSource,
          translationId,
        });

        const res = await fetch(`/api/preview?${params}`, { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to load preview");
        }

        const d = await res.json();

        const props: VideoCompositionProps = {
          ayahs: d.ayahs,
          timestamps: d.timestamps,
          wordTimings: d.wordTimings,
          audioUrls: (d.audioUrls as string[]).map((u: string) =>
            `/api/audio-proxy?url=${encodeURIComponent(u)}`
          ),
          backgroundColor: d.backgroundColor,
          backgroundImage: d.backgroundImage,
          backgroundImages: [],
          backgroundVideos: bgVideosRef.current,
          backgroundImageUrls: backgroundImageUrls,
          backgroundVideoUrls: backgroundVideoUrls,
          backgroundVideoDurations: backgroundVideoDurations,
          arabicFontSize: arabicFontSizeOverride ?? d.arabicFontSize,
          translationFontSize: translationFontSizeOverride ?? d.translationFontSize,
          arabicColor: d.arabicColor,
          translationColor: d.translationColor,
          arabicFontFamily: d.arabicFontFamily,
          format,
          wordHighlight: d.wordHighlight ?? wordHighlight,
          audioWaveform: d.audioWaveform ?? audioWaveform,
          transitionEffect: d.transitionEffect ?? transitionEffect,
          calligraphyEntrance: d.calligraphyEntrance ?? calligraphyEntrance,
          surahIntro: d.surahIntro ?? surahIntro,
          surahMeta: d.surahMeta ?? null,
        };

        setData({ props, totalDurationFrames: d.totalDurationFrames });
        hasFetchedOnce.current = true;
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Preview error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  const fmt = VIDEO_FORMATS[format];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-[10px] text-zinc-500">Loading preview...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-red-400">{error}</span>
          <button
            onClick={() => { hasFetchedOnce.current = false; setData(null); setError(null); }}
            className="text-[10px] text-emerald-400 hover:text-emerald-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[10px] text-zinc-500">Select source settings to preview</span>
      </div>
    );
  }

  return (
    <Player
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component={ShortVideo as any}
      inputProps={data.props as unknown as Record<string, unknown>}
      durationInFrames={Math.max(1, data.totalDurationFrames)}
      compositionWidth={fmt.width}
      compositionHeight={fmt.height}
      fps={30}
      controls
      acknowledgeRemotionLicense
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 8,
      }}
      autoPlay={false}
    />
  );
}
