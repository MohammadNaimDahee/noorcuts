import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { getRenderHistory } from "@/lib/db";

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TIXSLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TIXSLY_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { file, description } = body as { file?: string; description?: string };

  if (!file) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  // Prevent directory traversal
  const basename = path.basename(file);
  const filePath = path.join(process.cwd(), "output", userId, basename);

  // Verify ownership
  const history = await getRenderHistory(userId);
  const ownsFile = history.some(
    (job) => job.outputPath && path.basename(job.outputPath) === basename
  );
  if (!ownsFile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File([fileBuffer], basename, { type: "video/mp4" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description || "Quran recitation short");
    formData.append("video_type", "short");
    formData.append("title", description || "Quran recitation short");

    const res = await fetch("http://localhost:8000/api/webhook/video", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Tixsly rejected the upload: ${errText}` },
        { status: res.status }
      );
    }

    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send to Tixsly: ${message}` }, { status: 500 });
  }
}
