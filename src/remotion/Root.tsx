/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Composition } from "remotion";
import { ShortVideo } from "./ShortVideo";
import type { VideoCompositionProps } from "../types";
import { VIDEO_FORMATS } from "../types";

const defaultProps: VideoCompositionProps = {
  ayahs: [
    {
      surah: 1,
      ayah: 1,
      surahName: "الفاتحة",
      surahNameEn: "Al-Fatihah",
      arabic: "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ",
      translation_en:
        "In the name of Allah, the Entirely Merciful, the Especially Merciful.",
    },
  ],
  timestamps: [{ ayah: 1, startMs: 0, endMs: 5000 }],
  audioUrls: [],
  backgroundColor: "#000000",
  backgroundImage: null,
  backgroundVideos: [],
  arabicFontSize: 48,
  translationFontSize: 24,
  arabicColor: "#FFFFFF",
  translationColor: "#CCCCCC",
  arabicFontFamily: "Amiri Quran",
  format: "vertical",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(Object.keys(VIDEO_FORMATS) as Array<keyof typeof VIDEO_FORMATS>).map(
        (format) => {
          const config = VIDEO_FORMATS[format];
          return (
            <Composition
              key={format}
              id={`ShortVideo-${format}`}
              component={ShortVideo as any}
              durationInFrames={900}
              fps={30}
              width={config.width}
              height={config.height}
              defaultProps={{ ...defaultProps, format } as any}
            />
          );
        }
      )}
    </>
  );
};
