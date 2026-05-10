import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { getRenderHistory } from "@/lib/db";

export async function GET(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  // Prevent directory traversal
  const basename = path.basename(file);
  // Videos are stored per-user: output/{userId}/{filename}
  const filePath = path.join(process.cwd(), "output", userId, basename);

  // Verify the user owns this render
  const history = getRenderHistory(userId);
  const ownsFile = history.some(
    (job) => job.outputPath && path.basename(job.outputPath) === basename
  );
  if (!ownsFile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${basename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
