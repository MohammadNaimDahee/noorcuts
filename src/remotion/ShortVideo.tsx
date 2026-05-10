import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Audio,
  Sequence,
  Img,
  OffthreadVideo,
  staticFile,
} from "remotion";
import type { VideoCompositionProps } from "../types";
import { ARABIC_FONTS } from "../types";

/** Convert a number to Arabic-Indic numerals */
function toArabicNumeral(n: number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n)
    .split("")
    .map((d) => arabicDigits[parseInt(d, 10)])
    .join("");
}

/** Derive an accent color from the translation color (slightly warmer/golden) */
function deriveAccentColor(bgColor: string): string {
  // Map known bg colors to appropriate accents
  const accentMap: Record<string, string> = {
    "#0a0a14": "#D4AF37", // Classic Dark -> Gold
    "#0a1628": "#8899BB", // Midnight Blue -> Silver-blue
    "#1a1008": "#C4975A", // Desert Sand -> Warm gold
    "#061210": "#4DAA90", // Emerald Night -> Teal-green
    "#10081a": "#9B7EC8", // Royal Purple -> Soft purple
    "#F5F3EE": "#8B7355", // Pure White -> Warm brown
    "#1C1C1C": "#C4A77D", // Warm Charcoal -> Warm gold
    "#081418": "#5BA8B0", // Ocean Deep -> Teal
  };
  return accentMap[bgColor] || "#D4AF37";
}

/**
 * When background video is present, each template gets its own
 * high-contrast color set that preserves the template's personality
 * while ensuring text is readable over busy footage.
 */
function getVideoOverlayColors(bgColor: string): {
  arabicColor: string;
  translationColor: string;
  accentColor: string;
  overlayGradient: string;
} {
  const presets: Record<string, {
    arabicColor: string;
    translationColor: string;
    accentColor: string;
    overlayGradient: string;
  }> = {
    // Classic Dark -> bright white + gold, dark overlay
    "#0a0a14": {
      arabicColor: "#FFFFFF",
      translationColor: "#E8E0D0",
      accentColor: "#F0D060",
      overlayGradient: "linear-gradient(180deg, rgba(5,5,10,0.65) 0%, rgba(5,5,10,0.50) 40%, rgba(5,5,10,0.65) 100%)",
    },
    // Midnight Blue -> icy white + silver-blue, blue-tinted overlay
    "#0a1628": {
      arabicColor: "#F0F4FF",
      translationColor: "#B8C8E0",
      accentColor: "#90AADD",
      overlayGradient: "linear-gradient(180deg, rgba(5,12,25,0.70) 0%, rgba(5,12,25,0.55) 40%, rgba(5,12,25,0.70) 100%)",
    },
    // Desert Sand -> warm cream + amber, warm overlay
    "#1a1008": {
      arabicColor: "#FFF5E0",
      translationColor: "#E0C898",
      accentColor: "#E0A850",
      overlayGradient: "linear-gradient(180deg, rgba(15,10,4,0.70) 0%, rgba(15,10,4,0.55) 40%, rgba(15,10,4,0.70) 100%)",
    },
    // Emerald Night -> mint white + bright teal, green-tinted overlay
    "#061210": {
      arabicColor: "#E8FFF5",
      translationColor: "#A0D8C8",
      accentColor: "#60D0A8",
      overlayGradient: "linear-gradient(180deg, rgba(3,10,8,0.70) 0%, rgba(3,10,8,0.55) 40%, rgba(3,10,8,0.70) 100%)",
    },
    // Royal Purple -> lavender white + bright purple, purple overlay
    "#10081a": {
      arabicColor: "#F5EEFF",
      translationColor: "#C8B0E8",
      accentColor: "#B888E0",
      overlayGradient: "linear-gradient(180deg, rgba(8,4,15,0.70) 0%, rgba(8,4,15,0.55) 40%, rgba(8,4,15,0.70) 100%)",
    },
    // Pure White -> cream white + warm brown accent, dark overlay (light overlay looks unnatural over video)
    "#F5F3EE": {
      arabicColor: "#FFF8F0",
      translationColor: "#E0D8C8",
      accentColor: "#C8A878",
      overlayGradient: "linear-gradient(180deg, rgba(20,18,14,0.68) 0%, rgba(20,18,14,0.52) 40%, rgba(20,18,14,0.68) 100%)",
    },
    // Warm Charcoal -> warm white + warm gold, neutral dark overlay
    "#1C1C1C": {
      arabicColor: "#FFF8F0",
      translationColor: "#D0C0A8",
      accentColor: "#E0B870",
      overlayGradient: "linear-gradient(180deg, rgba(14,14,14,0.68) 0%, rgba(14,14,14,0.52) 40%, rgba(14,14,14,0.68) 100%)",
    },
    // Ocean Deep -> cool white + aqua, teal overlay
    "#081418": {
      arabicColor: "#E8F8FF",
      translationColor: "#90C8D8",
      accentColor: "#70C0D0",
      overlayGradient: "linear-gradient(180deg, rgba(4,10,14,0.70) 0%, rgba(4,10,14,0.55) 40%, rgba(4,10,14,0.70) 100%)",
    },
  };

  return presets[bgColor] || presets["#0a0a14"];
}

/** Check if a background is light */
function isLightBg(color: string): boolean {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

/** Horizontal ornamental divider */
const Divider: React.FC<{ width?: number; opacity?: number; color?: string }> = ({
  width = 240,
  opacity = 1,
  color = "#D4AF37",
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16, opacity }}>
    <div
      style={{
        width: width * 0.35,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${color})`,
      }}
    />
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: color,
      }}
    />
    <div
      style={{
        width: width * 0.35,
        height: 1,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }}
    />
  </div>
);

export const ShortVideo: React.FC<VideoCompositionProps> = ({
  ayahs,
  timestamps,
  audioUrls,
  backgroundColor,
  backgroundImage,
  backgroundVideos = [],
  arabicFontSize,
  translationFontSize,
  arabicColor,
  translationColor,
  arabicFontFamily = "Amiri Quran",
  format = "vertical",
}) => {
  const { width, height } = useVideoConfig();

  // Build @font-face declarations inside the component so staticFile() resolves correctly
  const fontFaces = useMemo(() => {
    const faces = ARABIC_FONTS.map(
      (f) => `@font-face {
  font-family: '${f.family}';
  src: url('${staticFile(`fonts/${f.file}`)}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`
    );
    // Also load Cormorant Garamond (English) and Amiri (fallback)
    faces.push(`@font-face {
  font-family: 'Cormorant Garamond';
  src: url('${staticFile("fonts/CormorantGaramond-Light.ttf")}') format('truetype');
  font-weight: 300;
  font-style: normal;
  font-display: block;
}`);
    faces.push(`@font-face {
  font-family: 'Amiri';
  src: url('${staticFile("fonts/Amiri-Regular.ttf")}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`);
    return faces.join("\n");
  }, []);
  const isHorizontal = format === "horizontal";
  const isSquare = format === "square";
  const scaleFactor = isHorizontal ? 0.9 : isSquare ? 0.85 : 1;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const hasBackgroundVideo = backgroundVideos.length > 0;

  // When background video is present, use per-template optimized colors
  const videoColors = hasBackgroundVideo ? getVideoOverlayColors(backgroundColor) : null;
  const effectiveArabicColor = videoColors ? videoColors.arabicColor : arabicColor;
  const effectiveTranslationColor = videoColors ? videoColors.translationColor : translationColor;
  const accentColor = videoColors ? videoColors.accentColor : deriveAccentColor(backgroundColor);
  const light = !hasBackgroundVideo && isLightBg(backgroundColor);
  const isLightTemplate = isLightBg(backgroundColor);
  const videoTextShadow = hasBackgroundVideo
    ? "0 2px 8px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6), 0 0 60px rgba(0,0,0,0.3)"
    : "";

  const activeIndex = timestamps.findIndex(
    (ts) => currentTimeMs >= ts.startMs && currentTimeMs < ts.endMs
  );
  const activeAyah = activeIndex >= 0 ? ayahs[activeIndex] : null;
  const activeTimestamp = activeIndex >= 0 ? timestamps[activeIndex] : null;

  let opacity = 1;
  let translateY = 0;
  if (activeTimestamp) {
    const duration = activeTimestamp.endMs - activeTimestamp.startMs;
    const elapsed = currentTimeMs - activeTimestamp.startMs;
    // Keep fade short and strictly within the timestamp window
    const fadeIn = Math.min(300, duration * 0.1);
    const fadeOut = Math.min(300, duration * 0.1);

    if (elapsed < fadeIn) {
      const t = elapsed / fadeIn;
      opacity = t;
      translateY = 8 * (1 - t);
    } else if (elapsed > duration - fadeOut) {
      const t = (duration - elapsed) / fadeOut;
      opacity = t;
      translateY = -5 * (1 - t);
    }
  }

  const showText = activeAyah !== null;

  const overlayColor = light ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const glowColor = accentColor + "0A"; // very subtle glow
  const borderColor = accentColor + (light ? "25" : "20");
  const borderColorFaint = accentColor + (light ? "12" : "0D");
  const accentFaded = accentColor + "40";

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Font faces */}
      <style dangerouslySetInnerHTML={{ __html: fontFaces }} />

      {/* Audio */}
      {timestamps.map((ts, i) => {
        const startFrame = Math.round((ts.startMs / 1000) * fps);
        const durationFrames = Math.round(((ts.endMs - ts.startMs) / 1000) * fps);
        const url = audioUrls[i];
        if (!url) return null;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <Audio src={url} />
          </Sequence>
        );
      })}

      {/* Background videos (sequential playlist) */}
      {hasBackgroundVideo &&
        (() => {
          // Distribute total duration evenly across clips, or loop if needed
          const totalFrames = durationInFrames;
          const clips = backgroundVideos;
          const framesPerClip = Math.ceil(totalFrames / clips.length);

          return clips.map((videoSrc, i) => (
            <Sequence
              key={`bg-video-${i}`}
              from={i * framesPerClip}
              durationInFrames={
                i === clips.length - 1
                  ? totalFrames - i * framesPerClip
                  : framesPerClip
              }
            >
              <OffthreadVideo
                src={staticFile(videoSrc)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                muted
              />
            </Sequence>
          ));
        })()}

      {/* Background image (only if no background videos) */}
      {!hasBackgroundVideo && backgroundImage && (
        <Img
          src={staticFile(backgroundImage)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            hasBackgroundVideo
              ? videoColors!.overlayGradient
              : backgroundImage
                ? `linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.55) 100%)`
                : `radial-gradient(ellipse at 50% 40%, ${backgroundColor} 0%, ${backgroundColor} 70%)`,
        }}
      />

      {/* Subtle accent glow */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "50%",
          width: 600,
          height: 600,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          borderRadius: "50%",
        }}
      />

      {/* Outer frame */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 50,
          right: 50,
          bottom: 50,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
        }}
      />
      {/* Inner frame */}
      <div
        style={{
          position: "absolute",
          top: 62,
          left: 62,
          right: 62,
          bottom: 62,
          border: `1px solid ${borderColorFaint}`,
          borderRadius: 12,
        }}
      />

      {/* Main content */}
      {showText && <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: isHorizontal ? "0 120px" : "0 80px",
          width: "100%",
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Surah header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12 * scaleFactor,
            marginBottom: 70 * scaleFactor,
          }}
        >
          <div
            style={{
              color: accentColor,
              fontSize: 20 * scaleFactor,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              letterSpacing: 8,
              textTransform: "uppercase",
              fontWeight: 300,
              textShadow: videoTextShadow,
            }}
          >
            Surah
          </div>
          <div
            style={{
              color: accentColor,
              fontSize: 30 * scaleFactor,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              letterSpacing: 4,
              fontWeight: 500,
              textShadow: videoTextShadow,
            }}
          >
            {activeAyah.surahNameEn}
          </div>
          <Divider width={200 * scaleFactor} opacity={0.5} color={accentColor} />
        </div>

        {/* Arabic text */}
        <div
          style={{
            color: effectiveArabicColor,
            fontSize: (arabicFontSize || 52) * scaleFactor,
            fontFamily: `'${arabicFontFamily}', 'Amiri', 'Traditional Arabic', serif`,
            textAlign: "center",
            lineHeight: 2.2,
            direction: "rtl",
            maxWidth: isHorizontal ? 1400 : 900,
            textShadow: videoTextShadow || (light ? "none" : `0 0 40px ${glowColor}`),
            marginBottom: 30 * scaleFactor,
          }}
        >
          {activeAyah.arabic}{" "}
          <span style={{ color: accentColor, textShadow: videoTextShadow }}>
            ﴿{toArabicNumeral(activeAyah.ayah)}﴾
          </span>
        </div>

        <div style={{ height: 40 * scaleFactor }} />

        <Divider width={280 * scaleFactor} opacity={0.35} color={accentColor} />

        <div style={{ height: 40 * scaleFactor }} />

        {/* English translation */}
        <div
          style={{
            color: effectiveTranslationColor,
            fontSize: (translationFontSize || 28) * scaleFactor,
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            textAlign: "center",
            lineHeight: 1.9,
            maxWidth: isHorizontal ? 1200 : 820,
            fontWeight: 300,
            fontStyle: "italic",
            textShadow: videoTextShadow,
          }}
        >
          &ldquo;{activeAyah.translation_en}&rdquo;
        </div>
      </div>}

      {/* Bottom surah name in Arabic */}
      {showText && <div
        style={{
          position: "absolute",
          bottom: 85,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Divider width={120} opacity={0.2} color={accentColor} />
        <div
          style={{
            color: accentFaded,
            fontSize: 24,
            fontFamily: `'${arabicFontFamily}', 'Amiri', serif`,
            letterSpacing: 2,
          }}
        >
          {activeAyah.surahName}
        </div>
      </div>}
    </div>
  );
};
