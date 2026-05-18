import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, unlink, appendFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "backgrounds", "uploads");
const TEMP_DIR = path.join(process.cwd(), "public", "backgrounds", "uploads", ".temp");

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "mp4", "webm", "mov"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// Chunked upload: client sends file in chunks
// POST with header X-Upload-Action: "start" to initiate
// POST with header X-Upload-Action: "chunk" to send a chunk
// POST with header X-Upload-Action: "finish" to finalize

export async function POST(request: NextRequest) {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
    if (!existsSync(TEMP_DIR)) {
      await mkdir(TEMP_DIR, { recursive: true });
    }

    const action = request.headers.get("x-upload-action") || "single";

    if (action === "start") {
      const { name } = await request.json();
      const ext = name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
          { status: 400 }
        );
      }
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempPath = path.join(TEMP_DIR, uploadId);
      await writeFile(tempPath, Buffer.alloc(0));
      return NextResponse.json({ uploadId, ext });
    }

    if (action === "chunk") {
      const uploadId = request.headers.get("x-upload-id");
      if (!uploadId || uploadId.includes("..") || uploadId.includes("/")) {
        return NextResponse.json({ error: "Invalid upload ID" }, { status: 400 });
      }
      const tempPath = path.join(TEMP_DIR, uploadId);
      if (!existsSync(tempPath)) {
        return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
      }
      const arrayBuffer = await request.arrayBuffer();
      await appendFile(tempPath, Buffer.from(arrayBuffer));
      return NextResponse.json({ ok: true });
    }

    if (action === "finish") {
      const { uploadId, ext } = await request.json();
      if (!uploadId || uploadId.includes("..") || uploadId.includes("/")) {
        return NextResponse.json({ error: "Invalid upload ID" }, { status: 400 });
      }
      const tempPath = path.join(TEMP_DIR, uploadId);
      if (!existsSync(tempPath)) {
        return NextResponse.json({ error: "Upload session not found" }, { status: 404 });
      }

      const isVideo = VIDEO_EXTENSIONS.includes(ext);
      const filename = `${uploadId}.${ext}`;
      const finalPath = path.join(UPLOAD_DIR, filename);

      const { rename } = await import("fs/promises");
      await rename(tempPath, finalPath);

      const url = `/backgrounds/uploads/${filename}`;
      return NextResponse.json({
        id: `upload-${filename}`,
        url,
        thumbnailUrl: url,
        type: isVideo ? "video" : "image",
        filename,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Upload error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ files: [] });
    }

    const entries = await readdir(UPLOAD_DIR);
    const files = entries
      .filter((f) => !f.startsWith("."))
      .map((filename) => {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const isVideo = VIDEO_EXTENSIONS.includes(ext);
        const url = `/backgrounds/uploads/${filename}`;
        return {
          id: `upload-${filename}`,
          url,
          thumbnailUrl: url,
          type: isVideo ? "video" : "image",
          filename,
        };
      });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("List uploads error:", error);
    return NextResponse.json({ error: "Failed to list uploads" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();
    if (!filename || filename.includes("..") || filename.includes("/")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filepath = path.join(UPLOAD_DIR, filename);
    if (existsSync(filepath)) {
      await unlink(filepath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
