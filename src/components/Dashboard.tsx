"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SurahInfo, Ayah, Template, RenderJob, VideoFormat, BackgroundVideo, ArabicFontId, Project, TransitionEffect } from "@/types";
import { VIDEO_FORMATS, ARABIC_FONTS } from "@/types";
import { NoorLogo } from "./NoorLogo";
import { SearchSelect } from "./SearchSelect";
import { UserButton } from "@clerk/nextjs";
import { PreviewPlayer } from "./PreviewPlayer";
type LeftTab = "source" | "style" | "background";

interface DashboardProps {
  projectId: number;
}

export function Dashboard({ projectId }: DashboardProps) {
  const router = useRouter();
  const [surahs, setSurahs] = useState<SurahInfo[]>([]);
  const [reciters, setReciters] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [renderHistory, setRenderHistory] = useState<RenderJob[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  // Form state
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [ayahStart, setAyahStart] = useState<number>(1);
  const [ayahEnd, setAyahEnd] = useState<number>(7);
  const [selectedReciter, setSelectedReciter] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<number>(1);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>("vertical");
  const [selectedFont, setSelectedFont] = useState<ArabicFontId>("amiri-quran");
  const [wordHighlight, setWordHighlight] = useState(false);
  const [audioWaveform, setAudioWaveform] = useState(false);
  const [transitionEffect, setTransitionEffect] = useState<TransitionEffect>("none");
  const [calligraphyEntrance, setCalligraphyEntrance] = useState(false);
  const [surahIntro, setSurahIntro] = useState(false);

  // Font size overrides (null = use template default)
  const [arabicFontSize, setArabicFontSize] = useState<number | null>(null);
  const [translationFontSize, setTranslationFontSize] = useState<number | null>(null);

  // Background video state
  const [bgVideoQuery, setBgVideoQuery] = useState("");
  const [bgVideoResults, setBgVideoResults] = useState<BackgroundVideo[]>([]);
  const [selectedBgVideos, setSelectedBgVideos] = useState<BackgroundVideo[]>([]);
  const [bgVideoSearching, setBgVideoSearching] = useState(false);
  const [bgVideoPage, setBgVideoPage] = useState(1);
  const [bgVideoTotalResults, setBgVideoTotalResults] = useState(0);
  const [bgSearchType, setBgSearchType] = useState<"video" | "photo">("video");
  const [bgPhotoResults, setBgPhotoResults] = useState<{ id: string; url: string; thumbnailUrl: string }[]>([]);
  const [bgPhotoPage, setBgPhotoPage] = useState(1);
  const [bgPhotoTotalResults, setBgPhotoTotalResults] = useState(0);
  const [selectedBgImages, setSelectedBgImages] = useState<{ id: string; url: string; thumbnailUrl: string }[]>([]);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  // Auto-clip state
  const [clipSuggestions, setClipSuggestions] = useState<Array<{ ayahStart: number; ayahEnd: number; durationLabel: string; reason: string }>>([]);
  const [clipLoading, setClipLoading] = useState(false);

  // Thumbnail state
  const [thumbnailLoading, setThumbnailLoading] = useState(false);

  // Tixsly state
  const [tixslyLoading, setTixslyLoading] = useState(false);
  const [tixslyResult, setTixslyResult] = useState<string | null>(null);

  // Translation state
  const [translations, setTranslations] = useState<Array<{ id: number; name: string; author_name: string; language_name: string }>>([]);
  const [selectedTranslation, setSelectedTranslation] = useState<string>("20"); // 20 = Saheeh International

  // Quran.com OAuth state
  const [qfConnected, setQfConnected] = useState(false);
  const [qfBookmarks, setQfBookmarks] = useState<Array<{ id: string; surah: number; ayah: number; createdAt: string }>>([]);
  const [qfBookmarksLoading, setQfBookmarksLoading] = useState(false);

  // UI state
  const [leftTab, setLeftTab] = useState<LeftTab>("source");
  const [preview, setPreview] = useState<Ayah[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStage, setRenderStage] = useState("");
  const [renderJobId, setRenderJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Load initial data + project
  useEffect(() => {
    // First fetch project info to determine data source
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch(`/api/render?projectId=${projectId}`).then((r) => r.json()),
    ]).then(async ([projectData, templateData, historyData]) => {
      setTemplates(templateData);
      setRenderHistory(Array.isArray(historyData) ? historyData : []);

      const allProjects = Array.isArray(projectData) ? projectData : [];
      const found = allProjects.find((p: Project) => p.id === projectId);
      if (!found) {
        router.push("/");
        return;
      }
      setProject(found);

      // Fetch surahs and reciters based on data source
      const useQf = found.dataSource === "quran.com";
      let surahData: SurahInfo[] = [];
      let reciterData: Array<{ id: string; name: string }> = [];

      try {
        [surahData, reciterData] = await Promise.all([
          useQf
            ? fetch("/api/qf/chapters").then((r) => {
                if (!r.ok) throw new Error("QF chapters failed");
                return r.json();
              }).then((d) =>
                (d.chapters || []).map((c: { id: number; name_arabic: string; name_simple: string; verses_count: number }) => ({
                  id: c.id,
                  name: c.name_arabic,
                  nameEn: c.name_simple,
                  totalVerses: c.verses_count,
                }))
              )
            : fetch("/api/quran").then((r) => r.json()),
          useQf
            ? fetch("/api/qf/reciters").then((r) => {
                if (!r.ok) throw new Error("QF reciters failed");
                return r.json();
              }).then((d) =>
                (d.recitations || []).map((r: { id: number; reciter_name: string; style: string | null }) => ({
                  id: String(r.id),
                  name: r.style ? `${r.reciter_name} (${r.style})` : r.reciter_name,
                }))
              )
            : fetch("/api/reciters").then((r) => r.json()),
        ]);
      } catch {
        // QF API failed — fall back to local data
        console.warn("Quran.com API failed, falling back to local data");
        [surahData, reciterData] = await Promise.all([
          fetch("/api/quran").then((r) => r.json()),
          fetch("/api/reciters").then((r) => r.json()),
        ]);
      }

      setSurahs(surahData);
      setReciters(reciterData);

      // Fetch available translations when using QF
      if (useQf) {
        try {
          const tRes = await fetch("/api/qf/translations");
          if (tRes.ok) {
            const tData = await tRes.json();
            setTranslations(tData.translations || []);
          }
        } catch {
          console.warn("Failed to fetch translations");
        }
      }

      // Load project settings into form
      if (found.surah) setSelectedSurah(found.surah);
      if (found.ayahStart) setAyahStart(found.ayahStart);
      if (found.ayahEnd) setAyahEnd(found.ayahEnd);
      if (found.reciterId) setSelectedReciter(found.reciterId);
      else if (reciterData.length > 0) setSelectedReciter(reciterData[0].id);
      if (found.templateId) setSelectedTemplate(found.templateId);
      else if (templateData.length > 0) setSelectedTemplate(templateData[0].id);
      if (found.format) setSelectedFormat(found.format as VideoFormat);
      if (found.arabicFont) setSelectedFont(found.arabicFont as ArabicFontId);
      if (found.wordHighlight !== undefined) setWordHighlight(found.wordHighlight);
      if (found.audioWaveform !== undefined) setAudioWaveform(found.audioWaveform);
      if (found.transitionEffect) setTransitionEffect(found.transitionEffect);
      if (found.calligraphyEntrance !== undefined) setCalligraphyEntrance(found.calligraphyEntrance);
      if (found.surahIntro !== undefined) setSurahIntro(found.surahIntro);

      setProjectLoading(false);
    });
  }, [projectId, router]);

  // Check Quran.com connection status
  useEffect(() => {
    fetch("/api/auth/qf/status").then((r) => r.json()).then((d) => {
      setQfConnected(d.connected === true);
    }).catch(() => setQfConnected(false));

    // Handle OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("qf_connected") === "true") {
      setQfConnected(true);
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("qf_connected");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    if (params.get("qf_error")) {
      setError(`Quran.com login failed: ${params.get("qf_error")}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("qf_error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  // Fetch bookmarks when connected
  const fetchBookmarks = useCallback(async () => {
    if (!qfConnected) return;
    setQfBookmarksLoading(true);
    try {
      const res = await fetch("/api/qf/bookmarks?type=ayah&mushafId=1&first=50");
      if (!res.ok) {
        if (res.status === 401) setQfConnected(false);
        return;
      }
      const data = await res.json();
      const bookmarks = (data.data || []).map((b: { id: string; key: number; verseNumber: number; createdAt: string }) => ({
        id: b.id,
        surah: b.key,
        ayah: b.verseNumber,
        createdAt: b.createdAt,
      }));
      setQfBookmarks(bookmarks);
    } catch (err) {
      console.error("Failed to fetch bookmarks:", err);
    } finally {
      setQfBookmarksLoading(false);
    }
  }, [qfConnected]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  useEffect(() => {
    if (projectLoading) return;
    const surah = surahs.find((s) => s.id === selectedSurah);
    if (surah && !project?.surah) {
      setAyahStart(1);
      setAyahEnd(Math.min(7, surah.totalVerses));
    }
  }, [selectedSurah, surahs, projectLoading, project?.surah]);

  const loadPreview = useCallback(async () => {
    if (project?.dataSource === "quran.com" && selectedReciter) {
      // Use preview API which is QF-aware and respects translationId
      const params = new URLSearchParams({
        surah: String(selectedSurah),
        ayahStart: String(ayahStart),
        ayahEnd: String(ayahEnd),
        reciterId: selectedReciter,
        templateId: String(selectedTemplate),
        format: selectedFormat,
        arabicFont: selectedFont,
        wordHighlight: "false",
        audioWaveform: "false",
        transitionEffect: "none",
        calligraphyEntrance: "false",
        surahIntro: "false",
        dataSource: "quran.com",
        translationId: selectedTranslation,
      });
      const res = await fetch(`/api/preview?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreview(data.ayahs || []);
      }
    } else {
      const res = await fetch(
        `/api/quran?surah=${selectedSurah}&ayahStart=${ayahStart}&ayahEnd=${ayahEnd}`
      );
      const data = await res.json();
      setPreview(data);
    }
  }, [selectedSurah, ayahStart, ayahEnd, project?.dataSource, selectedReciter, selectedTemplate, selectedFormat, selectedFont, selectedTranslation]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const searchBgVideos = async (page = 1) => {
    if (!bgVideoQuery.trim()) return;
    setBgVideoSearching(true);
    try {
      const orientation = selectedFormat === "horizontal" ? "landscape" : selectedFormat === "square" ? "square" : "portrait";
      if (bgSearchType === "video") {
        const res = await fetch(`/api/pexels?q=${encodeURIComponent(bgVideoQuery)}&orientation=${orientation}&page=${page}&per_page=15&type=video`);
        const data = await res.json();
        if (data.videos) {
          if (page === 1) {
            setBgVideoResults(data.videos);
          } else {
            setBgVideoResults((prev) => {
              const ids = new Set(prev.map((v: BackgroundVideo) => v.id));
              return [...prev, ...data.videos.filter((v: BackgroundVideo) => !ids.has(v.id))];
            });
          }
          setBgVideoPage(page);
          setBgVideoTotalResults(data.totalResults || 0);
        }
      } else {
        const res = await fetch(`/api/pexels?q=${encodeURIComponent(bgVideoQuery)}&orientation=${orientation}&page=${page}&per_page=15&type=photo`);
        const data = await res.json();
        if (data.photos) {
          if (page === 1) {
            setBgPhotoResults(data.photos);
          } else {
            setBgPhotoResults((prev) => {
              const ids = new Set(prev.map((p: { id: string }) => p.id));
              return [...prev, ...data.photos.filter((p: { id: string }) => !ids.has(p.id))];
            });
          }
          setBgPhotoPage(page);
          setBgPhotoTotalResults(data.totalResults || 0);
        }
      }
    } catch {
      // silently fail
    } finally {
      setBgVideoSearching(false);
    }
  };

  const fetchClipSuggestions = async () => {
    if (!selectedReciter) return;
    setClipLoading(true);
    try {
      const res = await fetch(`/api/autoclip?surah=${selectedSurah}&reciterId=${selectedReciter}`);
      const data = await res.json();
      if (Array.isArray(data)) setClipSuggestions(data);
    } catch { /* ignore */ } finally {
      setClipLoading(false);
    }
  };

  const handleThumbnail = async () => {
    setThumbnailLoading(true);
    try {
      const res = await fetch("/api/thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surah: selectedSurah,
          ayahStart,
          ayahEnd,
          reciterId: selectedReciter,
          templateId: selectedTemplate,
          format: selectedFormat,
          arabicFont: selectedFont,
          wordHighlight,
          transitionEffect,
          dataSource: project?.dataSource || "local",
        }),
      });
      if (!res.ok) throw new Error("Thumbnail generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `noorcuts-thumbnail-${selectedSurah}-${ayahStart}-${ayahEnd}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail error");
    } finally {
      setThumbnailLoading(false);
    }
  };

  const handleSendToTixsly = async () => {
    if (!downloadUrl) return;
    setTixslyLoading(true);
    setTixslyResult(null);
    try {
      const filename = downloadUrl.split("file=")[1] || "";
      const surahInfo = surahs.find((s) => s.id === selectedSurah);
      const description = `Surah ${surahInfo?.nameEn || selectedSurah} (${ayahStart}-${ayahEnd}) - Quran Recitation`;
      const res = await fetch("/api/tixsly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: decodeURIComponent(filename), description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setTixslyResult("Sent to Tixsly");
    } catch (err) {
      setTixslyResult(err instanceof Error ? err.message : "Send failed");
    } finally {
      setTixslyLoading(false);
    }
  };

  const toggleBgVideo = (video: BackgroundVideo) => {
    setSelectedBgVideos((prev) => {
      const exists = prev.find((v) => v.id === video.id);
      if (exists) return prev.filter((v) => v.id !== video.id);
      return [...prev, video];
    });
  };

  const handleSaveProject = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          surah: selectedSurah,
          ayahStart,
          ayahEnd,
          reciterId: selectedReciter,
          templateId: selectedTemplate,
          format: selectedFormat,
          arabicFont: selectedFont,
          wordHighlight,
          audioWaveform,
          transitionEffect,
          calligraphyEntrance,
          surahIntro,
        }),
      });
      const updated = await res.json();
      setProject(updated);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  const handleRender = async () => {
    setRendering(true);
    setRenderProgress(0);
    setRenderStage("Starting...");
    setRenderJobId(null);
    setError(null);
    setSuccess(null);
    setDownloadUrl(null);
    setPlayUrl(null);

    // Auto-save project settings before rendering
    await handleSaveProject();

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surah: selectedSurah,
          ayahStart,
          ayahEnd,
          reciterId: selectedReciter,
          templateId: selectedTemplate,
          format: selectedFormat,
          backgroundVideos: selectedBgVideos,
          backgroundImages: selectedBgImages.map((img) => ({ id: img.id, url: img.url })),
          arabicFont: selectedFont,
          wordHighlight,
          audioWaveform,
          transitionEffect,
          calligraphyEntrance,
          surahIntro,
          arabicFontSize: arabicFontSize ?? undefined,
          translationFontSize: translationFontSize ?? undefined,
          translationId: selectedTranslation,
          projectId,
          dataSource: project?.dataSource || "local",
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || "Render failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.trim().replace(/^data: /, "");
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine);
            if (event.type === "progress") {
              setRenderProgress(event.progress);
              setRenderStage(event.stage);
              if (event.jobId) setRenderJobId(event.jobId);
            } else if (event.type === "complete") {
              setSuccess(`Render complete! Job #${event.jobId}`);
              setRenderJobId(null);
              if (event.downloadUrl) {
                setDownloadUrl(event.downloadUrl);
                setPlayUrl(event.downloadUrl);
              }
              const histRes = await fetch(`/api/render?projectId=${projectId}`);
              setRenderHistory(await histRes.json());
            } else if (event.type === "cancelled") {
              setError("Render cancelled");
              setRenderJobId(null);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRendering(false);
      setRenderProgress(0);
      setRenderStage("");
      setRenderJobId(null);
    }
  };

  const handleCancelRender = async () => {
    if (!renderJobId) return;
    try {
      await fetch("/api/render/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: renderJobId }),
      });
    } catch {
      /* ignore */
    }
  };

  const reconnectToJob = useCallback(async (jobId: number) => {
    setRendering(true);
    setRenderProgress(0);
    setRenderStage("Reconnecting...");
    setError(null);
    setSuccess(null);
    setDownloadUrl(null);
    setPlayUrl(null);

    const refreshHistory = async () => {
      const histRes = await fetch(`/api/render?projectId=${projectId}`);
      setRenderHistory(await histRes.json());
    };

    try {
      // Poll progress endpoint every second
      const poll = async (): Promise<boolean> => {
        const res = await fetch(`/api/render/progress?jobId=${jobId}`);
        const data = await res.json();

        if (data.status === "not_found") {
          setRendering(false);
          await refreshHistory();
          return true;
        }

        if (data.status === "rendering") {
          setRenderProgress(data.progress);
          setRenderStage(data.stage);
          return false;
        }

        if (data.status === "completed") {
          setSuccess(`Render complete! Job #${data.jobId}`);
          if (data.downloadUrl) {
            setDownloadUrl(data.downloadUrl);
            setPlayUrl(data.downloadUrl);
          }
          setRendering(false);
          await refreshHistory();
          return true;
        }

        if (data.status === "failed") {
          setError(data.error || "Render failed");
          setRendering(false);
          await refreshHistory();
          return true;
        }

        return false;
      };

      const done = await poll();
      if (done) return;

      // Keep polling every 1s
      await new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          try {
            const isDone = await poll();
            if (isDone) {
              clearInterval(interval);
              resolve();
            }
          } catch {
            clearInterval(interval);
            resolve();
          }
        }, 1000);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reconnect");
    } finally {
      setRendering(false);
      setRenderProgress(0);
      setRenderStage("");
    }
  }, [projectId]);

  // Auto-reconnect to any rendering jobs on mount
  useEffect(() => {
    if (projectLoading) return;
    const renderingJob = renderHistory.find((j) => j.status === "rendering");
    if (renderingJob && !rendering) {
      reconnectToJob(renderingJob.id);
    }
    // Only run once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectLoading]);

  const currentSurah = surahs.find((s) => s.id === selectedSurah);
  const activeTemplate = templates.find((t) => t.id === selectedTemplate);
  const activeFont = ARABIC_FONTS.find((f) => f.id === selectedFont);
  const activeReciter = reciters.find((r) => r.id === selectedReciter);
  const fmt = VIDEO_FORMATS[selectedFormat];
  const aspectRatio = `${fmt.width}/${fmt.height}`;

  if (projectLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0e0e1e]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1a1a2e] text-zinc-200">
      {/* TOP TOOLBAR */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#2a2a4a] bg-[#16162a] px-4">
        {/* Left: Back + project name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-[#2a2a4a] hover:text-zinc-200 transition-colors"
            title="Back to projects"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <NoorLogo size={18} variant="mark" />
          </button>
          <div className="h-4 w-px bg-[#2a2a4a]" />
          <span className="text-xs font-medium text-zinc-300">{project?.name}</span>
          {project?.dataSource === "quran.com" && (
            qfConnected ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">Quran.com</span>
            ) : (
              <a
                href="/api/auth/qf/login"
                className="flex items-center gap-1 rounded bg-teal-600/20 px-2 py-0.5 text-[9px] font-medium text-teal-300 hover:bg-teal-600/30 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Sign in with Quran.com
              </a>
            )
          )}
          <button
            onClick={handleSaveProject}
            disabled={saving}
            className="rounded px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-600/10 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Center: Format selector */}
        <div className="flex items-center gap-1 rounded-md bg-[#0f0f20] p-0.5">
          {(Object.keys(VIDEO_FORMATS) as VideoFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFormat(f)}
              className={`rounded px-3 py-1 text-[11px] font-medium transition-all ${
                selectedFormat === f
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f === "vertical" ? "9:16" : f === "horizontal" ? "16:9" : "1:1"}
            </button>
          ))}
        </div>

        {/* Right: Render button + User */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRender}
            disabled={rendering || !selectedReciter}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rendering ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {renderProgress}%
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                </svg>
                Export
              </>
            )}
          </button>
          {rendering && (
            <button
              onClick={handleCancelRender}
              className="flex items-center gap-1.5 rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500"
              title="Cancel render"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          )}
          <UserButton
            appearance={{
              elements: { avatarBox: "h-7 w-7" },
            }}
          />
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="flex shrink-0">
          {/* Icon rail */}
          <div className="flex w-12 flex-col items-center gap-1 border-r border-[#2a2a4a] bg-[#12122a] py-3">
            {([
              { id: "source" as const, label: "Source", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
              { id: "style" as const, label: "Style", icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" },
              { id: "background" as const, label: "Media", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLeftTab(tab.id)}
                className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg transition-all ${
                  leftTab === tab.id
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-zinc-600 hover:bg-[#1e1e3a] hover:text-zinc-400"
                }`}
                title={tab.label}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span className="mt-0.5 text-[8px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="w-72 overflow-y-auto border-r border-[#2a2a4a] bg-[#16162a] p-4">
            {/* SOURCE TAB */}
            {leftTab === "source" && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Source</h3>

                <div>
                  <label className="studio-label">Surah</label>
                  <SearchSelect
                    options={surahs.map((s) => ({
                      value: String(s.id),
                      label: `${s.id}. ${s.nameEn} (${s.name})`,
                    }))}
                    value={String(selectedSurah)}
                    onChange={(v) => setSelectedSurah(parseInt(v, 10))}
                    placeholder="Search surah..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="studio-label">From</label>
                    <input
                      type="number"
                      min={1}
                      max={currentSurah?.totalVerses || 1}
                      value={ayahStart}
                      onChange={(e) => setAyahStart(parseInt(e.target.value, 10))}
                      className="studio-input"
                    />
                  </div>
                  <div>
                    <label className="studio-label">To</label>
                    <input
                      type="number"
                      min={ayahStart}
                      max={currentSurah?.totalVerses || 1}
                      value={ayahEnd}
                      onChange={(e) => setAyahEnd(parseInt(e.target.value, 10))}
                      className="studio-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="studio-label">Reciter</label>
                  <SearchSelect
                    options={reciters.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                    value={selectedReciter}
                    onChange={(v) => setSelectedReciter(v)}
                    placeholder="Search reciter..."
                  />
                </div>

                {/* Translation selector (only when using Quran.com data) */}
                {translations.length > 0 && (
                  <div>
                    <label className="studio-label">Translation</label>
                    <SearchSelect
                      options={(() => {
                        const sorted = [...translations].sort((a, b) => {
                          if (a.language_name === "english" && b.language_name !== "english") return -1;
                          if (a.language_name !== "english" && b.language_name === "english") return 1;
                          return a.language_name.localeCompare(b.language_name) || (a.author_name || a.name).localeCompare(b.author_name || b.name);
                        });
                        return sorted.map((t) => ({
                          value: String(t.id),
                          label: `${t.language_name.charAt(0).toUpperCase() + t.language_name.slice(1)} — ${t.author_name || t.name}`,
                        }));
                      })()}
                      value={selectedTranslation}
                      onChange={(v) => setSelectedTranslation(v)}
                      placeholder="Search translation..."
                    />
                  </div>
                )}

                <div className="border-t border-[#2a2a4a] pt-4">
                  <div className="space-y-1.5 text-[11px] text-zinc-500">
                    <div className="flex justify-between">
                      <span>Ayahs</span>
                      <span className="text-zinc-300">{ayahEnd - ayahStart + 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="text-zinc-300">{fmt.width}x{fmt.height}</span>
                    </div>
                    {activeReciter && (
                      <div className="flex justify-between">
                        <span>Reciter</span>
                        <span className="text-zinc-300 truncate ml-2 max-w-[120px]">{activeReciter.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#2a2a4a] pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Auto-Clip</h3>
                    <button
                      onClick={fetchClipSuggestions}
                      disabled={clipLoading || !selectedReciter}
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                    >
                      {clipLoading ? "Finding..." : "Find Clips"}
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-600 mb-2">Find optimal 30-60s segments</p>
                  {clipSuggestions.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {clipSuggestions.map((clip, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setAyahStart(clip.ayahStart);
                            setAyahEnd(clip.ayahEnd);
                          }}
                          className="flex w-full items-center justify-between rounded-md bg-[#0f0f20] px-2.5 py-1.5 text-left hover:bg-[#1a1a3a] transition-colors"
                        >
                          <div>
                            <span className="text-[10px] text-zinc-300">
                              {clip.ayahStart}-{clip.ayahEnd}
                            </span>
                            <span className="ml-1.5 text-[9px] text-zinc-600">{clip.reason}</span>
                          </div>
                          <span className="text-[9px] text-emerald-400 shrink-0">{clip.durationLabel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* BOOKMARKS */}
                {project?.dataSource === "quran.com" && (
                  <div className="border-t border-[#2a2a4a] pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Bookmarks</h3>
                      {qfConnected ? (
                        <button
                          onClick={fetchBookmarks}
                          disabled={qfBookmarksLoading}
                          className="text-[9px] text-teal-400 hover:text-teal-300 disabled:opacity-40"
                        >
                          {qfBookmarksLoading ? "Loading..." : "Refresh"}
                        </button>
                      ) : (
                        <a
                          href="/api/auth/qf/login"
                          className="text-[9px] text-teal-400 hover:text-teal-300"
                        >
                          Sign in
                        </a>
                      )}
                    </div>
                    {!qfConnected ? (
                      <p className="text-[9px] text-zinc-600">Sign in with Quran.com to import your bookmarked ayahs as clip suggestions</p>
                    ) : qfBookmarks.length === 0 ? (
                      <p className="text-[9px] text-zinc-600">{qfBookmarksLoading ? "Loading bookmarks..." : "No bookmarks found"}</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {qfBookmarks.map((bm) => {
                          const surahInfo = surahs.find((s) => s.id === bm.surah);
                          return (
                            <button
                              key={bm.id}
                              onClick={() => {
                                setSelectedSurah(bm.surah);
                                setAyahStart(bm.ayah);
                                setAyahEnd(Math.min(bm.ayah + 4, surahInfo?.totalVerses || bm.ayah));
                              }}
                              className="flex w-full items-center justify-between rounded-md bg-[#0f0f20] px-2.5 py-1.5 text-left hover:bg-[#1a1a3a] transition-colors"
                            >
                              <div>
                                <span className="text-[10px] text-zinc-300">
                                  {bm.surah}:{bm.ayah}
                                </span>
                                {surahInfo && (
                                  <span className="ml-1.5 text-[9px] text-zinc-600">{surahInfo.nameEn}</span>
                                )}
                              </div>
                              <span className="text-[9px] text-teal-400 shrink-0">Use</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STYLE TAB */}
            {leftTab === "style" && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Template</h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                        selectedTemplate === t.id
                          ? "border-emerald-500 ring-1 ring-emerald-500/30"
                          : "border-[#2a2a4a] hover:border-zinc-500"
                      }`}
                      title={t.name}
                    >
                      <div
                        className="flex flex-col items-center justify-center p-1.5"
                        style={{ backgroundColor: t.backgroundColor, minHeight: 52, gap: 2 }}
                      >
                        <span style={{ color: t.arabicColor, fontSize: 11, fontFamily: "serif", direction: "rtl" }}>
                          بِسۡمِ
                        </span>
                        <div style={{ width: 14, height: 1, background: `linear-gradient(90deg, transparent, ${t.arabicColor}40, transparent)` }} />
                        <span style={{ color: t.translationColor, fontSize: 6 }}>
                          Bismillah
                        </span>
                      </div>
                      {selectedTemplate === t.id && (
                        <div className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[7px] text-white">
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {activeTemplate && (
                  <div className="text-center text-[10px] text-zinc-600">{activeTemplate.name}</div>
                )}

                <div className="border-t border-[#2a2a4a] pt-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Arabic Font</h3>
                  <div className="space-y-1.5">
                    {ARABIC_FONTS.map((font) => {
                      const bgColor = activeTemplate?.backgroundColor || "#0a0a14";
                      const textColor = activeTemplate?.arabicColor || "#FFFFFF";
                      return (
                        <button
                          key={font.id}
                          onClick={() => setSelectedFont(font.id)}
                          className={`relative flex w-full items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 transition-all ${
                            selectedFont === font.id
                              ? "border-emerald-500 ring-1 ring-emerald-500/30"
                              : "border-[#2a2a4a] hover:border-zinc-500"
                          }`}
                        >
                          <div
                            className="flex h-8 w-12 shrink-0 items-center justify-center rounded"
                            style={{ backgroundColor: bgColor }}
                          >
                            <span dir="rtl" style={{ fontFamily: `'${font.family}', serif`, color: textColor, fontSize: 13 }}>
                              بِسۡمِ
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400">{font.label}</span>
                          {selectedFont === font.id && (
                            <div className="ml-auto flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[7px] text-white">
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[#2a2a4a] pt-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Effects</h3>
                  <div className="space-y-2">
                    {/* Word Highlight toggle */}
                    <label className="flex items-center justify-between cursor-pointer rounded-lg border border-[#2a2a4a] px-3 py-2.5 hover:border-zinc-500 transition-colors">
                      <div>
                        <div className="text-[11px] text-zinc-300">Word Highlight</div>
                        <div className="text-[9px] text-zinc-600">Highlight each word as it&apos;s recited</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={wordHighlight}
                        onClick={() => setWordHighlight(!wordHighlight)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          wordHighlight ? "bg-emerald-600" : "bg-[#2a2a4a]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            wordHighlight ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>

                    {/* Audio Waveform toggle */}
                    <label className="flex items-center justify-between cursor-pointer rounded-lg border border-[#2a2a4a] px-3 py-2.5 hover:border-zinc-500 transition-colors">
                      <div>
                        <div className="text-[11px] text-zinc-300">Audio Waveform</div>
                        <div className="text-[9px] text-zinc-600">Animated bars synced to recitation</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={audioWaveform}
                        onClick={() => setAudioWaveform(!audioWaveform)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          audioWaveform ? "bg-emerald-600" : "bg-[#2a2a4a]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            audioWaveform ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>

                    {/* Calligraphy Entrance toggle */}
                    <label className="flex items-center justify-between cursor-pointer rounded-lg border border-[#2a2a4a] px-3 py-2.5 hover:border-zinc-500 transition-colors">
                      <div>
                        <div className="text-[11px] text-zinc-300">Calligraphy Entrance</div>
                        <div className="text-[9px] text-zinc-600">Arabic text reveals like calligraphy</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={calligraphyEntrance}
                        onClick={() => setCalligraphyEntrance(!calligraphyEntrance)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          calligraphyEntrance ? "bg-emerald-600" : "bg-[#2a2a4a]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            calligraphyEntrance ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>

                    {/* Surah Intro toggle */}
                    <label className="flex items-center justify-between cursor-pointer rounded-lg border border-[#2a2a4a] px-3 py-2.5 hover:border-zinc-500 transition-colors">
                      <div>
                        <div className="text-[11px] text-zinc-300">Surah Intro</div>
                        <div className="text-[9px] text-zinc-600">Cinematic intro card with surah info</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={surahIntro}
                        onClick={() => setSurahIntro(!surahIntro)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          surahIntro ? "bg-emerald-600" : "bg-[#2a2a4a]"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                            surahIntro ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>

                    {/* Transition Effect selector */}
                    <div className="rounded-lg border border-[#2a2a4a] px-3 py-2.5">
                      <div className="text-[11px] text-zinc-300 mb-1.5">Transition Effect</div>
                      <div className="text-[9px] text-zinc-600 mb-2">Animation between ayahs</div>
                      <div className="grid grid-cols-4 gap-1">
                        {([
                          { id: "none" as const, label: "None" },
                          { id: "crossfade" as const, label: "Fade" },
                          { id: "slide" as const, label: "Slide" },
                          { id: "zoom" as const, label: "Zoom" },
                        ]).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setTransitionEffect(t.id)}
                            className={`rounded px-2 py-1 text-[10px] font-medium transition-all ${
                              transitionEffect === t.id
                                ? "bg-emerald-600 text-white"
                                : "bg-[#0f0f20] text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Font Size Controls */}
                <div className="border-t border-[#2a2a4a] pt-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Font Size</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-400">Arabic</span>
                        <span className="text-[10px] text-zinc-500">{arabicFontSize ?? "Default"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={24}
                          max={80}
                          step={2}
                          value={arabicFontSize ?? 48}
                          onChange={(e) => setArabicFontSize(Number(e.target.value))}
                          className="flex-1 h-1 accent-emerald-500 bg-[#2a2a4a] rounded-lg appearance-none cursor-pointer"
                        />
                        {arabicFontSize !== null && (
                          <button
                            onClick={() => setArabicFontSize(null)}
                            className="text-[8px] text-zinc-600 hover:text-zinc-400 shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-400">Translation</span>
                        <span className="text-[10px] text-zinc-500">{translationFontSize ?? "Default"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={12}
                          max={48}
                          step={1}
                          value={translationFontSize ?? 24}
                          onChange={(e) => setTranslationFontSize(Number(e.target.value))}
                          className="flex-1 h-1 accent-emerald-500 bg-[#2a2a4a] rounded-lg appearance-none cursor-pointer"
                        />
                        {translationFontSize !== null && (
                          <button
                            onClick={() => setTranslationFontSize(null)}
                            className="text-[8px] text-zinc-600 hover:text-zinc-400 shrink-0"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BACKGROUND TAB */}
            {leftTab === "background" && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Background Media</h3>
                <p className="text-[10px] text-zinc-600 -mt-2">Search Pexels for videos or images.</p>

                {/* Type toggle */}
                <div className="flex gap-1">
                  <button
                    onClick={() => { setBgSearchType("video"); setBgPhotoResults([]); setBgPhotoPage(1); }}
                    className={`rounded px-2.5 py-1 text-[10px] font-medium ${bgSearchType === "video" ? "bg-emerald-600 text-white" : "bg-[#0f0f20] text-zinc-500 hover:text-zinc-300"}`}
                  >
                    Videos
                  </button>
                  <button
                    onClick={() => { setBgSearchType("photo"); setBgVideoResults([]); setBgVideoPage(1); }}
                    className={`rounded px-2.5 py-1 text-[10px] font-medium ${bgSearchType === "photo" ? "bg-emerald-600 text-white" : "bg-[#0f0f20] text-zinc-500 hover:text-zinc-300"}`}
                  >
                    Images
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={bgVideoQuery}
                    onChange={(e) => setBgVideoQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchBgVideos(1)}
                    placeholder={bgSearchType === "video" ? "nature, ocean, stars..." : "mosque, mountains, sky..."}
                    className="studio-input flex-1"
                  />
                  <button
                    onClick={() => searchBgVideos(1)}
                    disabled={bgVideoSearching}
                    className="shrink-0 rounded-md bg-[#2a2a4a] px-3 py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-[#3a3a5a] disabled:opacity-50"
                  >
                    {bgVideoSearching ? "..." : "Search"}
                  </button>
                </div>

                {/* Selected background images */}
                {selectedBgImages.length > 0 && (
                  <div className="rounded-lg bg-[#0f0f20] p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                        {selectedBgImages.length} image{selectedBgImages.length > 1 ? "s" : ""} selected
                      </span>
                      <button onClick={() => setSelectedBgImages([])} className="text-[9px] text-red-400 hover:text-red-300">Clear</button>
                    </div>
                    <div className="flex gap-1 overflow-x-auto">
                      {selectedBgImages.map((img, i) => (
                        <div key={img.id} className="relative shrink-0 group">
                          <img src={img.thumbnailUrl} alt={`Image ${i + 1}`} className="h-9 w-14 rounded object-cover border border-emerald-500/40" />
                          <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[7px] px-0.5 rounded-br font-bold">{i + 1}</div>
                          <button
                            onClick={() => setSelectedBgImages((prev) => prev.filter((p) => p.id !== img.id))}
                            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-white text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected video clips */}
                {selectedBgVideos.length > 0 && (
                  <div className="rounded-lg bg-[#0f0f20] p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">
                        {selectedBgVideos.length} clip{selectedBgVideos.length > 1 ? "s" : ""} selected
                      </span>
                      <button onClick={() => setSelectedBgVideos([])} className="text-[9px] text-red-400 hover:text-red-300">
                        Clear
                      </button>
                    </div>
                    <div className="flex gap-1 overflow-x-auto">
                      {selectedBgVideos.map((v, i) => (
                        <div key={v.id} className="relative shrink-0 group">
                          <img src={v.thumbnailUrl} alt={`Clip ${i + 1}`} className="h-9 w-14 rounded object-cover border border-emerald-500/40" />
                          <div className="absolute top-0 left-0 bg-emerald-500 text-white text-[7px] px-0.5 rounded-br font-bold">{i + 1}</div>
                          <button
                            onClick={() => toggleBgVideo(v)}
                            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-white text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video preview player */}
                {previewVideoUrl && (
                  <div className="overflow-hidden rounded-lg border border-[#2a2a4a]">
                    <div className="flex items-center justify-between bg-[#0f0f20] px-2 py-1">
                      <span className="text-[9px] text-zinc-500">Preview</span>
                      <button onClick={() => setPreviewVideoUrl(null)} className="text-[9px] text-zinc-500 hover:text-white">Close</button>
                    </div>
                    <video src={previewVideoUrl} controls autoPlay muted className="w-full max-h-32 bg-black" />
                  </div>
                )}

                {/* Video results */}
                {bgSearchType === "video" && bgVideoResults.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-1">
                      {bgVideoResults.map((v) => {
                        const isSelected = selectedBgVideos.some((s) => s.id === v.id);
                        return (
                          <div
                            key={v.id}
                            className={`group relative overflow-hidden rounded border-2 transition-all cursor-pointer ${
                              isSelected ? "border-emerald-500" : "border-transparent hover:border-zinc-600"
                            }`}
                            onClick={() => toggleBgVideo(v)}
                          >
                            <img src={v.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setPreviewVideoUrl(previewVideoUrl === v.url ? null : v.url); }}
                              className="absolute bottom-0.5 left-0.5 h-4 w-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                              title="Preview"
                            >
                              <div className="ml-0.5 w-0 h-0 border-t-[2px] border-t-transparent border-b-[2px] border-b-transparent border-l-[4px] border-l-white" />
                            </button>
                            <div className={`absolute top-0.5 right-0.5 h-4 w-4 rounded flex items-center justify-center text-[8px] font-bold transition-opacity ${
                              isSelected
                                ? "bg-emerald-500 text-white opacity-100"
                                : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                            }`}>
                              {isSelected ? selectedBgVideos.findIndex((s) => s.id === v.id) + 1 : "+"}
                            </div>
                            <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[7px] px-0.5 rounded-tl">{v.duration}s</div>
                          </div>
                        );
                      })}
                    </div>
                    {bgVideoResults.length < bgVideoTotalResults && (
                      <button
                        onClick={() => searchBgVideos(bgVideoPage + 1)}
                        disabled={bgVideoSearching}
                        className="w-full rounded-md bg-[#1a1a3a] py-2 text-[10px] font-medium text-zinc-400 hover:bg-[#2a2a4a] hover:text-zinc-200 disabled:opacity-50"
                      >
                        {bgVideoSearching ? "Loading..." : `Load More (${bgVideoResults.length} of ${bgVideoTotalResults})`}
                      </button>
                    )}
                  </>
                )}

                {/* Photo results */}
                {bgSearchType === "photo" && bgPhotoResults.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-1">
                      {bgPhotoResults.map((p) => {
                        const isSelected = selectedBgImages.some((s) => s.id === p.id);
                        return (
                          <div
                            key={p.id}
                            className={`group relative overflow-hidden rounded border-2 transition-all cursor-pointer ${
                              isSelected ? "border-emerald-500" : "border-transparent hover:border-zinc-600"
                            }`}
                            onClick={() => {
                              setSelectedBgImages((prev) => {
                                if (prev.some((s) => s.id === p.id)) return prev.filter((s) => s.id !== p.id);
                                return [...prev, p];
                              });
                            }}
                          >
                            <img src={p.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
                            <div className={`absolute top-0.5 right-0.5 h-4 w-4 rounded flex items-center justify-center text-[8px] font-bold transition-opacity ${
                              isSelected
                                ? "bg-emerald-500 text-white opacity-100"
                                : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                            }`}>
                              {isSelected ? selectedBgImages.findIndex((s) => s.id === p.id) + 1 : "+"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {bgPhotoResults.length < bgPhotoTotalResults && (
                      <button
                        onClick={() => searchBgVideos(bgPhotoPage + 1)}
                        disabled={bgVideoSearching}
                        className="w-full rounded-md bg-[#1a1a3a] py-2 text-[10px] font-medium text-zinc-400 hover:bg-[#2a2a4a] hover:text-zinc-200 disabled:opacity-50"
                      >
                        {bgVideoSearching ? "Loading..." : `Load More (${bgPhotoResults.length} of ${bgPhotoTotalResults})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CENTER CANVAS */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[#0e0e1e] p-6">
          {/* Preview mode toggle */}
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(false)}
              className={`rounded px-3 py-1 text-[10px] font-medium transition-all ${
                !previewMode
                  ? "bg-[#2a2a4a] text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              disabled={!selectedReciter}
              className={`rounded px-3 py-1 text-[10px] font-medium transition-all ${
                previewMode
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              Preview
            </button>
          </div>

          {/* Preview Player — always mounted, hidden when not in preview mode */}
          <div
            className="relative overflow-hidden rounded-lg shadow-2xl shadow-black/50"
            style={{
              aspectRatio,
              maxHeight: "calc(100vh - 180px)",
              maxWidth: "100%",
              width: selectedFormat === "vertical" ? "auto" : "100%",
              height: selectedFormat === "vertical" ? "100%" : "auto",
              display: previewMode && selectedReciter ? "block" : "none",
            }}
          >
            {selectedReciter && (
              <PreviewPlayer
                surah={selectedSurah}
                ayahStart={ayahStart}
                ayahEnd={ayahEnd}
                reciterId={selectedReciter}
                templateId={selectedTemplate}
                format={selectedFormat}
                arabicFont={selectedFont}
                wordHighlight={wordHighlight}
                audioWaveform={audioWaveform}
                transitionEffect={transitionEffect}
                calligraphyEntrance={calligraphyEntrance}
                surahIntro={surahIntro}
                arabicFontSizeOverride={arabicFontSize}
                translationFontSizeOverride={translationFontSize}
                translationId={selectedTranslation}
                backgroundVideoUrls={selectedBgVideos.map((v) => v.url)}
                backgroundVideoDurations={selectedBgVideos.map((v) => v.duration)}
                backgroundImageUrls={selectedBgImages.map((img) => img.url)}
                dataSource={project?.dataSource || "local"}
              />
            )}
          </div>

          {/* Canvas — static preview */}
          <div
            className="relative overflow-hidden rounded-lg shadow-2xl shadow-black/50"
            style={{
              aspectRatio,
              maxHeight: "calc(100vh - 180px)",
              maxWidth: "100%",
              width: selectedFormat === "vertical" ? "auto" : "100%",
              height: selectedFormat === "vertical" ? "100%" : "auto",
              backgroundColor: activeTemplate?.backgroundColor || "#0a0a14",
              display: previewMode && selectedReciter ? "none" : "block",
            }}
          >
            <div className="flex h-full w-full flex-col items-center justify-center p-[8%]">
              <div className="mb-6 text-center">
                <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: activeTemplate?.translationColor || "#aaa", opacity: 0.5 }}>
                  {currentSurah?.nameEn || "Al-Fatiha"}
                </div>
              </div>

              <div className="w-full space-y-6 overflow-y-auto max-h-[80%] scrollbar-hide">
                {preview.length === 0 && (
                  <p className="text-center text-xs text-zinc-600">No ayahs selected</p>
                )}
                {preview.map((ayah) => (
                  <div key={`${ayah.surah}-${ayah.ayah}`} className="space-y-2 text-center">
                    <p
                      className="leading-[2.2]"
                      dir="rtl"
                      style={{
                        color: activeTemplate?.arabicColor || "#fff",
                        fontFamily: `'${activeFont?.family || "Amiri Quran"}', serif`,
                        fontSize: arabicFontSize
                          ? `${arabicFontSize * 0.45}px`
                          : selectedFormat === "vertical" ? "clamp(14px, 3.5vw, 22px)" : "clamp(16px, 2.5vw, 28px)",
                      }}
                    >
                      {ayah.arabic}
                    </p>
                    <div className="mx-auto" style={{ width: 40, height: 1, background: `linear-gradient(90deg, transparent, ${activeTemplate?.arabicColor || "#fff"}30, transparent)` }} />
                    <p
                      className="leading-relaxed italic"
                      style={{
                        color: activeTemplate?.translationColor || "#ccc",
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: translationFontSize
                          ? `${translationFontSize * 0.45}px`
                          : selectedFormat === "vertical" ? "clamp(9px, 1.8vw, 13px)" : "clamp(11px, 1.4vw, 16px)",
                        opacity: 0.85,
                      }}
                    >
                      {ayah.translation_en}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-mono text-zinc-500 backdrop-blur-sm">
              {fmt.width}x{fmt.height}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="text-emerald-400 font-medium">{project?.name}</span>
            <span>·</span>
            <span>{currentSurah?.nameEn} {ayahStart}-{ayahEnd}</span>
            <span>·</span>
            <span>{activeTemplate?.name}</span>
            <span>·</span>
            <span>{activeFont?.label}</span>
            {selectedBgVideos.length > 0 && (
              <>
                <span>·</span>
                <span>{selectedBgVideos.length} bg clip{selectedBgVideos.length > 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex w-64 shrink-0 flex-col border-l border-[#2a2a4a] bg-[#16162a]">
          {/* Output / Player section */}
          <div className="border-b border-[#2a2a4a] p-4">
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Output</h3>

            {rendering && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">{renderStage}</span>
                  <span className="text-[10px] font-mono text-emerald-400">{renderProgress}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#0f0f20]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              </div>
            )}

            {!rendering && error && <p className="text-[10px] text-red-400">{error}</p>}
            {!rendering && success && <p className="text-[10px] text-emerald-400">{success}</p>}

            {downloadUrl && !rendering && (
              <div className="mt-2 flex gap-1.5">
                <a
                  href={downloadUrl}
                  download
                  className="flex-1 rounded-md bg-blue-600 py-1.5 text-center text-[10px] font-semibold text-white hover:bg-blue-500"
                >
                  Download
                </a>
                <button
                  onClick={() => setPlayUrl(playUrl ? null : downloadUrl)}
                  className="flex-1 rounded-md bg-[#2a2a4a] py-1.5 text-[10px] font-semibold text-white hover:bg-[#3a3a5a]"
                >
                  {playUrl ? "Hide" : "Play"}
                </button>
                <button
                  onClick={handleSendToTixsly}
                  disabled={tixslyLoading}
                  className="flex-1 rounded-md bg-purple-600 py-1.5 text-[10px] font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition-colors"
                >
                  {tixslyLoading ? "Sending..." : "Tixsly"}
                </button>
              </div>
            )}
            {tixslyResult && !rendering && (
              <p className={`mt-1 text-[10px] ${tixslyResult === "Sent to Tixsly" ? "text-purple-400" : "text-red-400"}`}>
                {tixslyResult}
              </p>
            )}

            {playUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-[#2a2a4a]">
                <video
                  src={playUrl}
                  controls
                  autoPlay
                  className="w-full bg-black"
                  style={{ aspectRatio: selectedFormat === "horizontal" ? "16/9" : selectedFormat === "square" ? "1/1" : "9/16", maxHeight: "240px" }}
                />
              </div>
            )}

            {!rendering && !error && !success && !downloadUrl && (
              <div className="flex flex-col items-center gap-2 py-2">
                <NoorLogo size={20} variant="mark" className="opacity-30" />
                <p className="text-[10px] text-zinc-600">Click Export to render</p>
              </div>
            )}

            {/* Thumbnail button */}
            <div className="mt-3 border-t border-[#2a2a4a] pt-3">
              <button
                onClick={handleThumbnail}
                disabled={thumbnailLoading || !selectedReciter}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#2a2a4a] py-1.5 text-[10px] font-medium text-zinc-300 hover:bg-[#3a3a5a] disabled:opacity-40 transition-colors"
              >
                {thumbnailLoading ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500/30 border-t-zinc-300" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    Generate Thumbnail
                  </>
                )}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Render History</h3>
            {renderHistory.length === 0 && (
              <p className="text-[10px] text-zinc-600">No renders yet for this project</p>
            )}
            <div className="space-y-1">
              {renderHistory.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-md bg-[#0f0f20] px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-300 truncate">
                      S{job.surah}:{job.ayahStart}-{job.ayahEnd}
                    </div>
                    <div className="text-[8px] text-zinc-600">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {job.status === "completed" && job.outputPath && (
                      <>
                        <a
                          href={`/api/download?file=${encodeURIComponent(job.outputPath.split("/").pop() || "")}`}
                          download
                          className="text-[9px] text-blue-400 hover:text-blue-300"
                        >
                          DL
                        </a>
                        <button
                          onClick={() => {
                            const url = `/api/download?file=${encodeURIComponent(job.outputPath!.split("/").pop() || "")}`;
                            setPlayUrl(playUrl === url ? null : url);
                            setDownloadUrl(url);
                          }}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300"
                        >
                          Play
                        </button>
                      </>
                    )}
                    {job.status === "rendering" && !rendering && (
                      <button
                        onClick={() => reconnectToJob(job.id)}
                        className="text-[9px] text-yellow-400 hover:text-yellow-300"
                      >
                        View
                      </button>
                    )}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${
                        job.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : job.status === "failed"
                          ? "bg-red-500/10 text-red-400"
                          : job.status === "rendering"
                          ? "bg-yellow-500/10 text-yellow-400 cursor-pointer"
                          : "bg-[#2a2a4a] text-zinc-400"
                      }`}
                      onClick={job.status === "rendering" && !rendering ? () => reconnectToJob(job.id) : undefined}
                    >
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM STATUS BAR */}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-[#2a2a4a] bg-[#12122a] px-4 text-[9px] text-zinc-600">
        <div className="flex items-center gap-4">
          <span>{surahs.length} surahs</span>
          <span>{reciters.length} reciters</span>
          <span>{templates.length} templates</span>
        </div>
        <div className="flex items-center gap-4">
          {rendering && <span className="text-emerald-400">{renderStage} — {renderProgress}%</span>}
          <span>{renderHistory.filter((j) => j.status === "completed").length} renders</span>
        </div>
      </div>
    </div>
  );
}
