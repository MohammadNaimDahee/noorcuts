import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  Audio,
  Sequence,
  Img,
  OffthreadVideo,
  Video,
  staticFile,
} from "remotion";
import type { VideoCompositionProps, TransitionEffect } from "../types";
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
    "#1a0808": "#D47070", // Crimson Dusk -> Warm red
    "#F0E8D8": "#8A7A50", // Ivory Parchment -> Sepia
    "#0A0A0A": "#888888", // Obsidian -> Silver
    "#0A1A0A": "#6AAA58", // Forest Canopy -> Green
    "#1A1000": "#D4A030", // Amber Glow -> Amber
    "#1A1E28": "#6888B0", // Slate Blue -> Steel blue
    "#1A1018": "#C888A8", // Rose Gold -> Rose
    "#14141E": "#9090C0", // Moonlight -> Lavender
    // Minimalist
    "#FAFAFA": "#666666", // Minimal Snow -> Medium grey
    "#111111": "#888888", // Minimal Ink -> Silver
    "#E8E4E0": "#7A7870", // Minimal Stone -> Warm grey
    "#D0D4D8": "#506070", // Minimal Fog -> Steel
    "#F0F4F8": "#6080A0", // Minimal Cloud -> Muted blue
    "#EAE0D0": "#807058", // Minimal Sand -> Tan
    "#282828": "#909090", // Minimal Ash -> Light grey
    "#F8F0F4": "#906878", // Minimal Pearl -> Dusty rose
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
  const presets: Record<
    string,
    {
      arabicColor: string;
      translationColor: string;
      accentColor: string;
      overlayGradient: string;
    }
  > = {
    // Classic Dark -> bright white + gold, dark overlay
    "#0a0a14": {
      arabicColor: "#FFFFFF",
      translationColor: "#E8E0D0",
      accentColor: "#F0D060",
      overlayGradient:
        "linear-gradient(180deg, rgba(5,5,10,0.65) 0%, rgba(5,5,10,0.50) 40%, rgba(5,5,10,0.65) 100%)",
    },
    // Midnight Blue -> icy white + silver-blue, blue-tinted overlay
    "#0a1628": {
      arabicColor: "#F0F4FF",
      translationColor: "#B8C8E0",
      accentColor: "#90AADD",
      overlayGradient:
        "linear-gradient(180deg, rgba(5,12,25,0.70) 0%, rgba(5,12,25,0.55) 40%, rgba(5,12,25,0.70) 100%)",
    },
    // Desert Sand -> warm cream + amber, warm overlay
    "#1a1008": {
      arabicColor: "#FFF5E0",
      translationColor: "#E0C898",
      accentColor: "#E0A850",
      overlayGradient:
        "linear-gradient(180deg, rgba(15,10,4,0.70) 0%, rgba(15,10,4,0.55) 40%, rgba(15,10,4,0.70) 100%)",
    },
    // Emerald Night -> mint white + bright teal, green-tinted overlay
    "#061210": {
      arabicColor: "#E8FFF5",
      translationColor: "#A0D8C8",
      accentColor: "#60D0A8",
      overlayGradient:
        "linear-gradient(180deg, rgba(3,10,8,0.70) 0%, rgba(3,10,8,0.55) 40%, rgba(3,10,8,0.70) 100%)",
    },
    // Royal Purple -> lavender white + bright purple, purple overlay
    "#10081a": {
      arabicColor: "#F5EEFF",
      translationColor: "#C8B0E8",
      accentColor: "#B888E0",
      overlayGradient:
        "linear-gradient(180deg, rgba(8,4,15,0.70) 0%, rgba(8,4,15,0.55) 40%, rgba(8,4,15,0.70) 100%)",
    },
    // Pure White -> cream white + warm brown accent, dark overlay (light overlay looks unnatural over video)
    "#F5F3EE": {
      arabicColor: "#FFF8F0",
      translationColor: "#E0D8C8",
      accentColor: "#C8A878",
      overlayGradient:
        "linear-gradient(180deg, rgba(20,18,14,0.68) 0%, rgba(20,18,14,0.52) 40%, rgba(20,18,14,0.68) 100%)",
    },
    // Warm Charcoal -> warm white + warm gold, neutral dark overlay
    "#1C1C1C": {
      arabicColor: "#FFF8F0",
      translationColor: "#D0C0A8",
      accentColor: "#E0B870",
      overlayGradient:
        "linear-gradient(180deg, rgba(14,14,14,0.68) 0%, rgba(14,14,14,0.52) 40%, rgba(14,14,14,0.68) 100%)",
    },
    // Ocean Deep -> cool white + aqua, teal overlay
    "#081418": {
      arabicColor: "#E8F8FF",
      translationColor: "#90C8D8",
      accentColor: "#70C0D0",
      overlayGradient:
        "linear-gradient(180deg, rgba(4,10,14,0.70) 0%, rgba(4,10,14,0.55) 40%, rgba(4,10,14,0.70) 100%)",
    },
    // Crimson Dusk -> warm white + rose, deep red overlay
    "#1a0808": {
      arabicColor: "#FFE8E0",
      translationColor: "#D4908A",
      accentColor: "#E07060",
      overlayGradient:
        "linear-gradient(180deg, rgba(15,4,4,0.70) 0%, rgba(15,4,4,0.55) 40%, rgba(15,4,4,0.70) 100%)",
    },
    // Ivory Parchment -> dark brown + muted olive, warm dark overlay
    "#F0E8D8": {
      arabicColor: "#FFF8F0",
      translationColor: "#C8B898",
      accentColor: "#B8A070",
      overlayGradient:
        "linear-gradient(180deg, rgba(20,16,10,0.70) 0%, rgba(20,16,10,0.55) 40%, rgba(20,16,10,0.70) 100%)",
    },
    // Obsidian -> pure white + neutral grey, deep black overlay
    "#0A0A0A": {
      arabicColor: "#FFFFFF",
      translationColor: "#B0B0B0",
      accentColor: "#909090",
      overlayGradient:
        "linear-gradient(180deg, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.55) 40%, rgba(5,5,5,0.72) 100%)",
    },
    // Forest Canopy -> mint white + leaf green, forest overlay
    "#0A1A0A": {
      arabicColor: "#E0F0D8",
      translationColor: "#8AB878",
      accentColor: "#70A860",
      overlayGradient:
        "linear-gradient(180deg, rgba(5,14,5,0.70) 0%, rgba(5,14,5,0.55) 40%, rgba(5,14,5,0.70) 100%)",
    },
    // Amber Glow -> warm cream + amber gold, warm dark overlay
    "#1A1000": {
      arabicColor: "#FFE8B0",
      translationColor: "#E0A030",
      accentColor: "#D09020",
      overlayGradient:
        "linear-gradient(180deg, rgba(14,8,0,0.70) 0%, rgba(14,8,0,0.55) 40%, rgba(14,8,0,0.70) 100%)",
    },
    // Slate Blue -> cool white + steel blue, slate overlay
    "#1A1E28": {
      arabicColor: "#E0E8F0",
      translationColor: "#7890B0",
      accentColor: "#6880A0",
      overlayGradient:
        "linear-gradient(180deg, rgba(12,14,20,0.70) 0%, rgba(12,14,20,0.55) 40%, rgba(12,14,20,0.70) 100%)",
    },
    // Rose Gold -> pink white + rose, mauve overlay
    "#1A1018": {
      arabicColor: "#FFE8F0",
      translationColor: "#D4A0B8",
      accentColor: "#C890A8",
      overlayGradient:
        "linear-gradient(180deg, rgba(14,8,12,0.70) 0%, rgba(14,8,12,0.55) 40%, rgba(14,8,12,0.70) 100%)",
    },
    // Moonlight -> cool lavender + indigo, deep blue overlay
    "#14141E": {
      arabicColor: "#F0F0FF",
      translationColor: "#A0A0D0",
      accentColor: "#8888C0",
      overlayGradient:
        "linear-gradient(180deg, rgba(10,10,16,0.70) 0%, rgba(10,10,16,0.55) 40%, rgba(10,10,16,0.70) 100%)",
    },
    // Minimal Snow -> dark text, neutral dark overlay
    "#FAFAFA": {
      arabicColor: "#F0F0F0",
      translationColor: "#B0B0B0",
      accentColor: "#808080",
      overlayGradient:
        "linear-gradient(180deg, rgba(15,15,15,0.68) 0%, rgba(15,15,15,0.52) 40%, rgba(15,15,15,0.68) 100%)",
    },
    // Minimal Ink -> light text, deep dark overlay
    "#111111": {
      arabicColor: "#EEEEEE",
      translationColor: "#999999",
      accentColor: "#777777",
      overlayGradient:
        "linear-gradient(180deg, rgba(8,8,8,0.72) 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.72) 100%)",
    },
    // Minimal Stone -> warm neutral, dark overlay
    "#E8E4E0": {
      arabicColor: "#F0ECE8",
      translationColor: "#B0A898",
      accentColor: "#908878",
      overlayGradient:
        "linear-gradient(180deg, rgba(18,16,14,0.68) 0%, rgba(18,16,14,0.52) 40%, rgba(18,16,14,0.68) 100%)",
    },
    // Minimal Fog -> cool grey, slate overlay
    "#D0D4D8": {
      arabicColor: "#E8ECF0",
      translationColor: "#A0A8B0",
      accentColor: "#708090",
      overlayGradient:
        "linear-gradient(180deg, rgba(14,16,18,0.68) 0%, rgba(14,16,18,0.52) 40%, rgba(14,16,18,0.68) 100%)",
    },
    // Minimal Cloud -> blue-white, neutral overlay
    "#F0F4F8": {
      arabicColor: "#F0F4FF",
      translationColor: "#A0B0C0",
      accentColor: "#7090B0",
      overlayGradient:
        "linear-gradient(180deg, rgba(12,14,18,0.68) 0%, rgba(12,14,18,0.52) 40%, rgba(12,14,18,0.68) 100%)",
    },
    // Minimal Sand -> warm cream, warm dark overlay
    "#EAE0D0": {
      arabicColor: "#FFF5E8",
      translationColor: "#C0B098",
      accentColor: "#A09070",
      overlayGradient:
        "linear-gradient(180deg, rgba(18,14,10,0.68) 0%, rgba(18,14,10,0.52) 40%, rgba(18,14,10,0.68) 100%)",
    },
    // Minimal Ash -> neutral light, dark overlay
    "#282828": {
      arabicColor: "#E8E8E8",
      translationColor: "#A0A0A0",
      accentColor: "#808080",
      overlayGradient:
        "linear-gradient(180deg, rgba(12,12,12,0.70) 0%, rgba(12,12,12,0.55) 40%, rgba(12,12,12,0.70) 100%)",
    },
    // Minimal Pearl -> pink-tinted white, rose dark overlay
    "#F8F0F4": {
      arabicColor: "#FFF0F4",
      translationColor: "#C0A0B0",
      accentColor: "#A08090",
      overlayGradient:
        "linear-gradient(180deg, rgba(16,12,14,0.68) 0%, rgba(16,12,14,0.52) 40%, rgba(16,12,14,0.68) 100%)",
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

/** Linearly interpolate between two hex colors */
function lerpColor(from: string, to: string, t: number): string {
  const f = from.replace("#", "");
  const t2 = to.replace("#", "");
  const fr = parseInt(f.substring(0, 2), 16);
  const fg = parseInt(f.substring(2, 4), 16);
  const fb = parseInt(f.substring(4, 6), 16);
  const tr = parseInt(t2.substring(0, 2), 16);
  const tg = parseInt(t2.substring(2, 4), 16);
  const tb = parseInt(t2.substring(4, 6), 16);
  const r = Math.round(fr + (tr - fr) * t);
  const g = Math.round(fg + (tg - fg) * t);
  const b = Math.round(fb + (tb - fb) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Horizontal ornamental divider */
const Divider: React.FC<{
  width?: number;
  opacity?: number;
  color?: string;
}> = ({ width = 240, opacity = 1, color = "#D4AF37" }) => (
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

/** Noorcuts watermark logo (inline SVG for Remotion rendering) */
const NoorLogoMark: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="wm-bg"
        x1="0"
        y1="0"
        x2="64"
        y2="64"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient
        id="wm-gold"
        x1="24"
        y1="16"
        x2="48"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#wm-bg)" />
    <circle cx="24" cy="28" r="18" fill="#047857" opacity="0.5" />
    <path d="M27 19l18 13-18 13z" fill="url(#wm-gold)" />
    <line
      x1="50"
      y1="10"
      x2="56"
      y2="4"
      stroke="#fde68a"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.8"
    />
    <line
      x1="54"
      y1="16"
      x2="60"
      y2="12"
      stroke="#fde68a"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
    <line
      x1="52"
      y1="6"
      x2="56"
      y2="2"
      stroke="#fde68a"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
    />
  </svg>
);

/** Noorcuts watermark — appears at intro and outro */
const Watermark: React.FC<{
  position: "top-left" | "bottom-right";
  opacity: number;
  scaleFactor: number;
}> = ({ position, opacity, scaleFactor }) => (
  <div
    style={{
      position: "absolute",
      top: position === "top-left" ? 90 : undefined,
      left: position === "top-left" ? 80 : undefined,
      bottom: position === "bottom-right" ? 90 : undefined,
      right: position === "bottom-right" ? 80 : undefined,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 10 * scaleFactor,
      opacity,
      zIndex: 10,
    }}
  >
    <NoorLogoMark size={30 * scaleFactor} />
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <span
        style={{
          fontSize: 14 * scaleFactor,
          fontWeight: 700,
          letterSpacing: 2,
          color: "#34d399",
          fontFamily: "sans-serif",
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        NOORCUTS
      </span>
      <span
        style={{
          fontSize: 8 * scaleFactor,
          fontWeight: 500,
          letterSpacing: 3,
          color: "rgba(255,255,255,0.45)",
          fontFamily: "sans-serif",
          textTransform: "uppercase",
        }}
      >
        Studio
      </span>
    </div>
  </div>
);

export const ShortVideo: React.FC<VideoCompositionProps> = ({
  ayahs,
  timestamps,
  wordTimings = [],
  audioUrls,
  backgroundColor,
  backgroundImage,
  backgroundImages = [],
  backgroundVideos = [],
  backgroundImageUrls = [],
  backgroundVideoUrls = [],
  backgroundVideoDurations = [],
  arabicFontSize,
  translationFontSize,
  arabicColor,
  translationColor,
  arabicFontFamily = "Amiri Quran",
  format = "vertical",
  wordHighlight = false,
  audioWaveform = false,
  transitionEffect = "none",
  calligraphyEntrance = false,
  surahIntro = false,
  surahMeta = null,
  overlayOpacity = 55,
}) => {
  const { width, height } = useVideoConfig();

  // Build @font-face declarations — only load the selected Arabic font + English/fallback
  const fontFaces = useMemo(() => {
    const faces: string[] = [];
    // Only load the Arabic font that's actually selected
    const selectedFont = ARABIC_FONTS.find((f) => f.family === arabicFontFamily);
    if (selectedFont) {
      faces.push(`@font-face {
  font-family: '${selectedFont.family}';
  src: url('${staticFile(`fonts/${selectedFont.file}`)}') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}`);
    }
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
  }, [arabicFontFamily]);
  const isHorizontal = format === "horizontal";
  const isSquare = format === "square";
  const scaleFactor = isHorizontal ? 0.9 : isSquare ? 0.85 : 1;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const hasBackgroundVideo = backgroundVideos.length > 0 || backgroundVideoUrls.length > 0;
  // Resolve image sources: direct URLs (preview) or staticFile paths (render)
  const resolvedBgImages = backgroundImageUrls.length > 0
    ? backgroundImageUrls
    : backgroundImages.length > 0
      ? backgroundImages.map((p) => staticFile(p))
      : backgroundImage
        ? [staticFile(backgroundImage)]
        : [];
  const hasBackgroundImage = resolvedBgImages.length > 0;
  const hasBackground = hasBackgroundVideo || hasBackgroundImage;

  // When background video/image is present, use per-template optimized colors
  const videoColors = hasBackground
    ? getVideoOverlayColors(backgroundColor)
    : null;
  const effectiveArabicColor = videoColors
    ? videoColors.arabicColor
    : arabicColor;
  const effectiveTranslationColor = videoColors
    ? videoColors.translationColor
    : translationColor;
  const accentColor = videoColors
    ? videoColors.accentColor
    : deriveAccentColor(backgroundColor);
  const light = !hasBackground && isLightBg(backgroundColor);
  const isLightTemplate = isLightBg(backgroundColor);
  const videoTextShadow = hasBackground
    ? "0 2px 8px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.6), 0 0 60px rgba(0,0,0,0.3)"
    : "";

  const activeIndex = timestamps.findIndex(
    (ts) => currentTimeMs >= ts.startMs && currentTimeMs <= ts.endMs,
  );
  const activeAyah = activeIndex >= 0 ? ayahs[activeIndex] : null;
  const activeTimestamp = activeIndex >= 0 ? timestamps[activeIndex] : null;

  // Long ayah pagination — compute which "page" of words to show
  // Split on waqf (stop) marks: ۚ ۖ ۗ ۘ ۙ ۛ
  const WAQF_REGEX = /[\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB]/;
  const MIN_PAGE_WORDS = 5;
  const MAX_PAGE_WORDS = 12;
  const activeArabicWords = activeAyah ? activeAyah.arabic.split(/\s+/) : [];
  const activeAyahWt = activeIndex >= 0 ? wordTimings[activeIndex] : null;
  const activeHasTimings = wordHighlight && activeAyahWt && activeAyahWt.words.length > 0;

  // Build pages based on waqf marks
  const ayahPages: { start: number; end: number }[] = [];
  if (activeArabicWords.length > MAX_PAGE_WORDS) {
    let pageStart = 0;
    for (let wi = 0; wi < activeArabicWords.length; wi++) {
      const isWaqf = WAQF_REGEX.test(activeArabicWords[wi]);
      const wordsInPage = wi - pageStart + 1;
      const wordsRemaining = activeArabicWords.length - wi - 1;

      if (isWaqf && wordsInPage >= MIN_PAGE_WORDS) {
        ayahPages.push({ start: pageStart, end: wi + 1 });
        pageStart = wi + 1;
      } else if (wordsInPage >= MAX_PAGE_WORDS) {
        // Force split at MAX if no waqf found
        ayahPages.push({ start: pageStart, end: wi + 1 });
        pageStart = wi + 1;
      } else if (wi === activeArabicWords.length - 1) {
        // Last segment: merge with previous if too short
        if (wordsRemaining === 0 && wordsInPage < MIN_PAGE_WORDS && ayahPages.length > 0) {
          const prev = ayahPages[ayahPages.length - 1];
          prev.end = activeArabicWords.length;
        } else {
          ayahPages.push({ start: pageStart, end: activeArabicWords.length });
        }
      }
    }
    // Handle trailing words not yet added
    if (ayahPages.length > 0 && ayahPages[ayahPages.length - 1].end < activeArabicWords.length) {
      const remaining = activeArabicWords.length - ayahPages[ayahPages.length - 1].end;
      if (remaining < MIN_PAGE_WORDS) {
        ayahPages[ayahPages.length - 1].end = activeArabicWords.length;
      } else {
        ayahPages.push({ start: ayahPages[ayahPages.length - 1].end, end: activeArabicWords.length });
      }
    }
  }
  const isLongAyah = ayahPages.length > 1;

  let pageVisibleStart = 0;
  let pageVisibleEnd = activeArabicWords.length;
  let currentPageIdx = 0;

  if (isLongAyah && activeHasTimings && activeAyahWt) {
    // Find which word is currently being spoken
    let currentWordIdx = 0;
    for (const [wStart, , segStart, segEnd] of activeAyahWt.words) {
      if (currentTimeMs >= Number(segStart) && currentTimeMs < Number(segEnd)) {
        currentWordIdx = Number(wStart);
        break;
      }
      if (currentTimeMs >= Number(segEnd)) {
        currentWordIdx = Number(wStart);
      }
    }
    // Find which page contains this word
    for (let pi = 0; pi < ayahPages.length; pi++) {
      if (currentWordIdx >= ayahPages[pi].start && currentWordIdx < ayahPages[pi].end) {
        currentPageIdx = pi;
        break;
      }
    }
    pageVisibleStart = ayahPages[currentPageIdx].start;
    pageVisibleEnd = ayahPages[currentPageIdx].end;
  }

  // Split translation to match Arabic pages using word-by-word translations
  const translationText = activeAyah?.translation_en || "";
  let visibleTranslation = translationText;
  if (isLongAyah && ayahPages.length > 1) {
    // Split translation on sentence-level punctuation to match pages
    const splitRegex = /(?<=[.;:,!?])\s+/;
    const rawParts = translationText.split(splitRegex);
    const transParts: string[] = [];

    if (rawParts.length >= ayahPages.length) {
      const partsPerPage = rawParts.length / ayahPages.length;
      for (let pi = 0; pi < ayahPages.length; pi++) {
        const tStart = Math.round(pi * partsPerPage);
        const tEnd = Math.round((pi + 1) * partsPerPage);
        transParts.push(rawParts.slice(tStart, tEnd).join(" "));
      }
    } else {
      const transWords = translationText.split(/\s+/);
      const wordsPerPage = transWords.length / ayahPages.length;
      for (let pi = 0; pi < ayahPages.length; pi++) {
        const tStart = Math.round(pi * wordsPerPage);
        const tEnd = Math.round((pi + 1) * wordsPerPage);
        transParts.push(transWords.slice(tStart, tEnd).join(" "));
      }
    }
    visibleTranslation = transParts[currentPageIdx] || translationText;
  }

  let opacity = 1;
  let translateY = 0;
  let translateX = 0;
  let scale = 1;
  if (activeTimestamp) {
    const duration = activeTimestamp.endMs - activeTimestamp.startMs;
    const elapsed = currentTimeMs - activeTimestamp.startMs;
    // Keep fade short and strictly within the timestamp window
    const fadeIn = Math.min(300, duration * 0.1);
    const fadeOut = Math.min(300, duration * 0.1);

    const effectType: TransitionEffect = transitionEffect || "none";

    if (elapsed < fadeIn) {
      const t = elapsed / fadeIn;
      opacity = t;
      if (effectType === "slide") {
        translateX = 60 * (1 - t);
      } else if (effectType === "zoom") {
        scale = 0.85 + 0.15 * t;
      } else {
        translateY = 8 * (1 - t);
      }
    } else if (elapsed > duration - fadeOut) {
      const t = (duration - elapsed) / fadeOut;
      opacity = t;
      if (effectType === "slide") {
        translateX = -60 * (1 - t);
      } else if (effectType === "zoom") {
        scale = 1 + 0.1 * (1 - t);
      } else {
        translateY = -5 * (1 - t);
      }
    }
  }

  // Calligraphy entrance: mask-reveal effect on Arabic text
  let calligraphyProgress = 1;
  if (calligraphyEntrance && activeTimestamp) {
    const elapsed = currentTimeMs - activeTimestamp.startMs;
    const revealDuration = 800; // ms for full reveal
    calligraphyProgress = Math.min(1, elapsed / revealDuration);
    // Ease out cubic
    calligraphyProgress = 1 - Math.pow(1 - calligraphyProgress, 3);
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
        const durationFrames = Math.round(
          ((ts.endMs - ts.startMs) / 1000) * fps,
        );
        const url = audioUrls[i];
        if (!url) return null;
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <Audio src={url} />
          </Sequence>
        );
      })}

      {/* Background videos (sequential playlist, loops from start when all finish) */}
      {hasBackgroundVideo &&
        (() => {
          const totalFrames = durationInFrames;
          const isDirectUrl = backgroundVideoUrls.length > 0;
          const clips = isDirectUrl
            ? backgroundVideoUrls
            : backgroundVideos.map((v) => staticFile(v));

          // Compute per-clip frame durations from actual durations if available
          const clipFrames = backgroundVideoDurations.length === clips.length
            ? backgroundVideoDurations.map((d) => Math.round(d * 30))
            : null;
          const playlistDurationFrames = clipFrames
            ? clipFrames.reduce((a, b) => a + b, 0)
            : 0;

          if (clipFrames && playlistDurationFrames > 0) {
            const sequences: { src: string; from: number; duration: number }[] = [];
            let framePos = 0;

            if (playlistDurationFrames >= totalFrames) {
              // More video than needed: show ALL clips, each trimmed proportionally
              // Each clip gets a share of totalFrames proportional to its original duration
              const totalClipFrames = clipFrames.reduce((a, b) => a + b, 0);
              for (let i = 0; i < clips.length && framePos < totalFrames; i++) {
                const proportion = clipFrames[i] / totalClipFrames;
                const dur = i === clips.length - 1
                  ? totalFrames - framePos
                  : Math.round(proportion * totalFrames);
                if (dur > 0) {
                  sequences.push({ src: clips[i], from: framePos, duration: Math.min(dur, totalFrames - framePos) });
                  framePos += dur;
                }
              }
            } else {
              // Less video than needed: play all clips in order, then loop from start
              while (framePos < totalFrames) {
                for (let i = 0; i < clips.length && framePos < totalFrames; i++) {
                  const dur = Math.min(clipFrames[i], totalFrames - framePos);
                  sequences.push({ src: clips[i], from: framePos, duration: dur });
                  framePos += dur;
                }
              }
            }

            return sequences.map((seq, i) => (
              <Sequence
                key={`bg-video-${i}`}
                from={seq.from}
                durationInFrames={seq.duration}
              >
                {isDirectUrl ? (
                  <Video
                    src={seq.src}
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
                ) : (
                  <OffthreadVideo
                    src={seq.src}
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
                )}
              </Sequence>
            ));
          }

          // Fallback: no durations known — split evenly
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
              {isDirectUrl ? (
                <Video
                  src={videoSrc}
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
              ) : (
                <OffthreadVideo
                  src={videoSrc}
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
              )}
            </Sequence>
          ));
        })()}

      {/* Background images (sequential slideshow, only if no background videos) */}
      {!hasBackgroundVideo && hasBackgroundImage &&
        (() => {
          if (resolvedBgImages.length === 1) {
            // Single image — full duration
            return (
              <Img
                src={resolvedBgImages[0]}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            );
          }
          // Multiple images — distribute as slideshow
          const totalFrames = durationInFrames;
          const framesPerImage = Math.ceil(totalFrames / resolvedBgImages.length);
          return resolvedBgImages.map((imgSrc, i) => (
            <Sequence
              key={`bg-img-${i}`}
              from={i * framesPerImage}
              durationInFrames={
                i === resolvedBgImages.length - 1
                  ? totalFrames - i * framesPerImage
                  : framesPerImage
              }
            >
              <Img
                src={imgSrc}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Sequence>
          ));
        })()}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: hasBackground
            ? `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity / 100}) 0%, rgba(0,0,0,${(overlayOpacity - 10) / 100}) 40%, rgba(0,0,0,${overlayOpacity / 100}) 100%)`
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

      {/* Surah Intro Card */}
      {surahIntro &&
        surahMeta &&
        (() => {
          const introDuration = surahMeta.introDurationMs;
          const fadeInMs = 600;
          const holdMs = introDuration - 1200;
          const fadeOutMs = 600;

          if (currentTimeMs >= introDuration) return null;

          let introOpacity = 1;
          if (currentTimeMs < fadeInMs) {
            introOpacity = currentTimeMs / fadeInMs;
          } else if (currentTimeMs > fadeInMs + holdMs) {
            introOpacity = Math.max(
              0,
              (introDuration - currentTimeMs) / fadeOutMs,
            );
          }

          // Subtle scale animation: 1.05 -> 1.0
          const introScale =
            1.05 - 0.05 * Math.min(1, currentTimeMs / introDuration);

          // Ornamental line grow animation
          const lineProgress = Math.min(1, currentTimeMs / 1200);
          const lineWidth = 200 * scaleFactor * lineProgress;

          // Staggered text reveals
          const titleDelay = 200;
          const subtitleDelay = 600;
          const metaDelay = 1000;

          const titleOpacity = Math.min(
            1,
            Math.max(0, (currentTimeMs - titleDelay) / 400),
          );
          const titleY = 20 * (1 - titleOpacity);
          const subtitleOpacity = Math.min(
            1,
            Math.max(0, (currentTimeMs - subtitleDelay) / 400),
          );
          const subtitleY = 15 * (1 - subtitleOpacity);
          const metaOpacity = Math.min(
            1,
            Math.max(0, (currentTimeMs - metaDelay) / 400),
          );

          const revelationLabel =
            surahMeta.revelationType === "meccan" ? "Meccan" : "Medinan";
          const revelationArabic =
            surahMeta.revelationType === "meccan" ? "مكية" : "مدنية";

          return (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: introOpacity,
                transform: `scale(${introScale})`,
              }}
            >
              {/* Bismillah / opening */}
              <div
                style={{
                  color: accentColor,
                  fontSize: 22 * scaleFactor,
                  fontFamily: `'${arabicFontFamily}', 'Amiri', serif`,
                  opacity: metaOpacity,
                  marginBottom: 40 * scaleFactor,
                  textShadow: videoTextShadow || `0 2px 12px ${accentColor}20`,
                }}
              >
                بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
              </div>

              {/* Ornamental line top */}
              <Divider
                width={lineWidth}
                opacity={0.6 * lineProgress}
                color={accentColor}
              />

              <div style={{ height: 30 * scaleFactor }} />

              {/* Surah name Arabic — large */}
              <div
                style={{
                  color: effectiveArabicColor,
                  fontSize: 72 * scaleFactor,
                  fontFamily: `'${arabicFontFamily}', 'Amiri', serif`,
                  opacity: titleOpacity,
                  transform: `translateY(${titleY}px)`,
                  textShadow: videoTextShadow || `0 4px 20px ${accentColor}15`,
                  lineHeight: 1.4,
                }}
              >
                {surahMeta.name}
              </div>

              <div style={{ height: 12 * scaleFactor }} />

              {/* Surah name English */}
              <div
                style={{
                  color: accentColor,
                  fontSize: 28 * scaleFactor,
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontWeight: 300,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                  opacity: subtitleOpacity,
                  transform: `translateY(${subtitleY}px)`,
                  textShadow: videoTextShadow,
                }}
              >
                {surahMeta.nameEn}
              </div>

              <div style={{ height: 30 * scaleFactor }} />

              {/* Ornamental line bottom */}
              <Divider
                width={lineWidth * 0.7}
                opacity={0.4 * lineProgress}
                color={accentColor}
              />

              <div style={{ height: 30 * scaleFactor }} />

              {/* Metadata row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24 * scaleFactor,
                  opacity: metaOpacity,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      color: effectiveTranslationColor,
                      fontSize: 10 * scaleFactor,
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      letterSpacing: 3,
                      textTransform: "uppercase",
                      opacity: 0.6,
                      textShadow: videoTextShadow,
                    }}
                  >
                    Verses
                  </span>
                  <span
                    style={{
                      color: effectiveArabicColor,
                      fontSize: 20 * scaleFactor,
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      fontWeight: 500,
                      textShadow: videoTextShadow,
                    }}
                  >
                    {surahMeta.totalVerses}
                  </span>
                </div>

                <div
                  style={{
                    width: 1,
                    height: 30 * scaleFactor,
                    backgroundColor: accentColor,
                    opacity: 0.3,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      color: effectiveTranslationColor,
                      fontSize: 10 * scaleFactor,
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      letterSpacing: 3,
                      textTransform: "uppercase",
                      opacity: 0.6,
                      textShadow: videoTextShadow,
                    }}
                  >
                    Revelation
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        color: effectiveArabicColor,
                        fontSize: 18 * scaleFactor,
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontWeight: 500,
                        textShadow: videoTextShadow,
                      }}
                    >
                      {revelationLabel}
                    </span>
                    <span
                      style={{
                        color: accentColor,
                        fontSize: 16 * scaleFactor,
                        fontFamily: `'${arabicFontFamily}', 'Amiri', serif`,
                        opacity: 0.7,
                      }}
                    >
                      {revelationArabic}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Main content */}
      {showText && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: isHorizontal ? "0 120px" : "0 80px",
            width: "100%",
            opacity,
            transform: `translateY(${translateY}px) translateX(${translateX}px) scale(${scale})`,
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
            <Divider
              width={200 * scaleFactor}
              opacity={0.5}
              color={accentColor}
            />
          </div>

          {/* Arabic text — word-by-word with highlight */}
          <div
            style={{
              color: effectiveArabicColor,
              fontSize: (arabicFontSize || 52) * scaleFactor,
              fontFamily: `'${arabicFontFamily}', 'Amiri', 'Traditional Arabic', serif`,
              textAlign: "center",
              lineHeight: 2.2,
              direction: "rtl",
              maxWidth: isHorizontal ? 1400 : 900,
              marginBottom: 30 * scaleFactor,
              // Calligraphy entrance: clip from right-to-left (RTL text reveal)
              ...(calligraphyEntrance && calligraphyProgress < 1
                ? {
                    clipPath: `inset(0 0 0 ${(1 - calligraphyProgress) * 100}%)`,
                  }
                : {}),
            }}
          >
            {(() => {
              const arabicWords = activeArabicWords;
              const ayahWt = activeAyahWt;
              const hasTimings = activeHasTimings;
              const displayWords = arabicWords.slice(pageVisibleStart, pageVisibleEnd);

              return (
                <>
                  {displayWords.map((word, di) => {
                    const i = pageVisibleStart + di;
                    let wordColor = effectiveArabicColor;
                    let wordGlow =
                      videoTextShadow ||
                      (light ? "none" : `0 0 40px ${glowColor}`);
                    let wordScale = 1;

                    if (hasTimings && ayahWt) {
                      // Find this word's timing
                      const seg = ayahWt.words.find(([wStart, wEnd]) => i >= Number(wStart) && i < Number(wEnd));

                      if (seg) {
                        const [, , wStart, wEnd] = seg;
                        const fadeMs = 150; // smooth fade duration

                        if (currentTimeMs >= wStart && currentTimeMs < wEnd) {
                          // Active word — compute fade-in progress
                          const elapsed = currentTimeMs - wStart;
                          const t = Math.min(1, elapsed / fadeMs);
                          wordColor = lerpColor(
                            effectiveArabicColor,
                            accentColor,
                            t,
                          );
                          wordGlow = `0 0 ${20 * t}px ${accentColor}${Math.round(
                            96 * t,
                          )
                            .toString(16)
                            .padStart(2, "0")}`;
                          wordScale = 1 + 0.05 * t;
                        } else if (currentTimeMs >= wEnd) {
                          // Already spoken — fade back
                          const elapsed = currentTimeMs - wEnd;
                          const t = Math.max(0, 1 - elapsed / (fadeMs * 2));
                          if (t > 0) {
                            wordColor = lerpColor(
                              effectiveArabicColor,
                              accentColor,
                              t * 0.5,
                            );
                            wordGlow = `0 0 ${10 * t}px ${accentColor}${Math.round(
                              48 * t,
                            )
                              .toString(16)
                              .padStart(2, "0")}`;
                          } else {
                            wordGlow =
                              videoTextShadow ||
                              (light ? "none" : `0 0 40px ${glowColor}`);
                          }
                        }
                      }
                    }

                    return (
                      <React.Fragment key={i}>
                        <span
                          style={{
                            color: wordColor,
                            textShadow: wordGlow,
                            display: "inline-block",
                            transform:
                              wordScale !== 1
                                ? `scale(${wordScale})`
                                : undefined,
                          }}
                        >
                          {word}
                        </span>
                        {di < displayWords.length - 1 ? " " : ""}
                      </React.Fragment>
                    );
                  })}{" "}
                  {/* Show ayah number only on the last page */}
                  {pageVisibleEnd >= arabicWords.length && (
                    <span
                      style={{ color: accentColor, textShadow: videoTextShadow }}
                    >
                      ﴿{toArabicNumeral(activeAyah.ayah)}﴾
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          <div style={{ height: 40 * scaleFactor }} />

          <Divider
            width={280 * scaleFactor}
            opacity={0.35}
            color={accentColor}
          />

          <div style={{ height: 40 * scaleFactor }} />

          {/* English translation */}
          <div
            style={{
              color: effectiveTranslationColor,
              fontSize: (translationFontSize || 32) * scaleFactor,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              textAlign: "center",
              lineHeight: 1.9,
              maxWidth: isHorizontal ? 1200 : 820,
              fontWeight: 300,
              fontStyle: "italic",
              textShadow: videoTextShadow,
            }}
          >
            &ldquo;{visibleTranslation}&rdquo;
          </div>
        </div>
      )}

      {/* Bottom surah name in Arabic */}
      {showText && (
        <div
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
        </div>
      )}

      {/* Audio waveform visualizer */}
      {audioWaveform &&
        showText &&
        (() => {
          // Generate pseudo-random waveform bars based on frame + ayah timing
          const barCount = isHorizontal ? 60 : 40;
          const barWidth = isHorizontal ? 3 : 2.5;
          const barGap = isHorizontal ? 2 : 1.5;
          const maxBarHeight = 28 * scaleFactor;
          const totalWidth = barCount * (barWidth + barGap);

          // Simulate audio energy based on elapsed time within ayah
          const ayahElapsed = activeTimestamp
            ? currentTimeMs - activeTimestamp.startMs
            : 0;
          const ayahDuration = activeTimestamp
            ? activeTimestamp.endMs - activeTimestamp.startMs
            : 1;
          const normalizedTime = ayahElapsed / ayahDuration;

          // Energy envelope: ramp up, sustain, ramp down
          let energy = 1;
          if (normalizedTime < 0.05) energy = normalizedTime / 0.05;
          else if (normalizedTime > 0.95) energy = (1 - normalizedTime) / 0.05;

          return (
            <div
              style={{
                position: "absolute",
                bottom: 60,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "flex-end",
                gap: barGap,
                height: maxBarHeight,
                opacity: 0.5 * opacity,
                zIndex: 2,
              }}
            >
              {Array.from({ length: barCount }).map((_, i) => {
                // Use sin waves at different frequencies for pseudo-random look
                const seed = i * 0.7 + frame * 0.15;
                const wave1 = Math.sin(seed) * 0.5 + 0.5;
                const wave2 = Math.sin(seed * 1.7 + 2.3) * 0.3 + 0.5;
                const wave3 = Math.sin(seed * 0.3 + 5.1) * 0.2 + 0.5;
                // Center bars are taller
                const centerBias =
                  1 - (Math.abs(i - barCount / 2) / (barCount / 2)) * 0.4;
                const h = Math.max(
                  2,
                  (wave1 * wave2 + wave3) *
                    maxBarHeight *
                    energy *
                    centerBias *
                    0.7,
                );

                return (
                  <div
                    key={i}
                    style={{
                      width: barWidth,
                      height: h,
                      borderRadius: barWidth / 2,
                      backgroundColor: accentColor,
                      opacity: 0.6 + wave1 * 0.4,
                    }}
                  />
                );
              })}
            </div>
          );
        })()}

      {/* Watermark — intro (top, first 2s) and outro (bottom, last 2s) */}
      {(() => {
        const introMs = 5000;
        const outroMs = 2000;
        const fadeDuration = 500; // ms for fade in/out
        const totalMs = (durationInFrames / fps) * 1000;

        // Intro watermark (top) — visible 0 to introMs with fade in/out
        let introOpacity = 0;
        if (currentTimeMs < introMs) {
          if (currentTimeMs < fadeDuration) {
            introOpacity = currentTimeMs / fadeDuration;
          } else if (currentTimeMs > introMs - fadeDuration) {
            introOpacity = (introMs - currentTimeMs) / fadeDuration;
          } else {
            introOpacity = 1;
          }
        }

        // Outro watermark (bottom) — visible last outroMs
        let outroOpacity = 0;
        const outroStart = totalMs - outroMs;
        if (currentTimeMs > outroStart) {
          const outroElapsed = currentTimeMs - outroStart;
          if (outroElapsed < fadeDuration) {
            outroOpacity = outroElapsed / fadeDuration;
          } else if (outroElapsed > outroMs - fadeDuration) {
            outroOpacity = (outroMs - outroElapsed) / fadeDuration;
          } else {
            outroOpacity = 1;
          }
        }

        return (
          <>
            {introOpacity > 0 && (
              <Watermark
                position="top-left"
                opacity={introOpacity}
                scaleFactor={scaleFactor}
              />
            )}
            {outroOpacity > 0 && (
              <Watermark
                position="bottom-right"
                opacity={outroOpacity}
                scaleFactor={scaleFactor}
              />
            )}
          </>
        );
      })()}
    </div>
  );
};
