import { NextResponse } from "next/server";
import { cancelRender } from "@/lib/render-progress";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const jobId = body.jobId;

  if (!jobId || typeof jobId !== "number") {
    return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
  }

  const cancelled = cancelRender(jobId);

  if (cancelled) {
    return NextResponse.json({ success: true, message: "Render cancelled" });
  }

  return NextResponse.json(
    { success: false, message: "No active render found for this job" },
    { status: 404 }
  );
}
