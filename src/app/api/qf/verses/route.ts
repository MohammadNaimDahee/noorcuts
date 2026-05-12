import { NextResponse } from "next/server";
import { getAllVersesByChapter } from "@/lib/qf-content";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get("chapter");
  const translations = searchParams.get("translations") || "20"; // 20 = Saheeh International

  if (!chapter) {
    return NextResponse.json({ error: "Missing chapter parameter" }, { status: 400 });
  }

  try {
    const verses = await getAllVersesByChapter(Number(chapter), translations);
    return NextResponse.json({ verses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
