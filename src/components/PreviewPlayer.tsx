"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Player } from "@remotion/player";
import { ShortVideo } from "@/remotion/ShortVideo";
import { VIDEO_FORMATS } from "@/types";
import type { VideoCompositionProps, VideoFormat, ArabicFontId, TransitionEffect } from "@/types";

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
  backgroundVideos?: string[];
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
  backgroundVideos = [],
}: PreviewPlayerProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bgVideosRef = useRef(backgroundVideos);
  bgVideosRef.current = backgroundVideos;

  // Stable key for when to re-fetch (only primitive deps)
  const fetchKey = `${surah}-${ayahStart}-${ayahEnd}-${reciterId}-${templateId}-${format}-${arabicFont}-${wordHighlight}-${audioWaveform}-${transitionEffect}-${calligraphyEntrance}`;

  const loadPreview = useCallback(async () => {
    if (!surah || !ayahStart || !ayahEnd || !reciterId) return;

    setLoading(true);
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
      });

      const res = await fetch(`/api/preview?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to load preview");
      }

      const d = await res.json();

      const props: VideoCompositionProps = {
        ayahs: d.ayahs,
        timestamps: d.timestamps,
        wordTimings: d.wordTimings,
        audioUrls: d.audioUrls,
        backgroundColor: d.backgroundColor,
        backgroundImage: d.backgroundImage,
        backgroundVideos: bgVideosRef.current,
        arabicFontSize: d.arabicFontSize,
        translationFontSize: d.translationFontSize,
        arabicColor: d.arabicColor,
        translationColor: d.translationColor,
        arabicFontFamily: d.arabicFontFamily,
        format,
        wordHighlight: d.wordHighlight ?? wordHighlight,
        audioWaveform: d.audioWaveform ?? audioWaveform,
        transitionEffect: d.transitionEffect ?? transitionEffect,
        calligraphyEntrance: d.calligraphyEntrance ?? calligraphyEntrance,
      };

      setData({
        props,
        totalDurationFrames: d.totalDurationFrames,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const fmt = VIDEO_FORMATS[format];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <span className="text-[10px] text-zinc-500">Loading preview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-red-400">{error}</span>
          <button
            onClick={loadPreview}
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
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 8,
      }}
      autoPlay={false}
    />
  );
}
