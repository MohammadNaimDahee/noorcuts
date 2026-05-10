import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRenderProgress } from "@/lib/render-progress";

export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobIdStr = searchParams.get("jobId");
  if (!jobIdStr) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const jobId = parseInt(jobIdStr, 10);
  const current = getRenderProgress(jobId);

  if (!current) {
    return NextResponse.json({ status: "not_found", jobId });
  }

  return NextResponse.json(current);
}
