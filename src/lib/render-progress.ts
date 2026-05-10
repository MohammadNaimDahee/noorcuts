// In-memory render progress tracking
// Allows clients to poll progress of ongoing renders

export interface RenderProgressState {
  stage: string;
  progress: number;
  status: "rendering" | "completed" | "failed";
  error?: string;
  downloadUrl?: string;
  jobId: number;
  updatedAt: number;
}

const progressMap = new Map<number, RenderProgressState>();

export function updateRenderProgress(jobId: number, state: Partial<RenderProgressState>): void {
  const existing = progressMap.get(jobId) || {
    stage: "",
    progress: 0,
    status: "rendering" as const,
    jobId,
    updatedAt: Date.now(),
  };
  const updated = { ...existing, ...state, updatedAt: Date.now() };
  progressMap.set(jobId, updated);

  // Clean up completed/failed jobs after 5 minutes
  if (updated.status === "completed" || updated.status === "failed") {
    setTimeout(() => {
      progressMap.delete(jobId);
    }, 5 * 60 * 1000);
  }
}

export function getRenderProgress(jobId: number): RenderProgressState | undefined {
  return progressMap.get(jobId);
}
