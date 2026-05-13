import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const surah = searchParams.get("surah");
  const reciterId = searchParams.get("reciterId");

  const { getReciters, getRecitations } = await import("@/lib/quran");

  // If no params, return list of reciters
  if (!surah || !reciterId) {
    return NextResponse.json(
      getReciters().map((r) => ({ id: r.id, name: r.name }))
    );
  }

  const surahNum = parseInt(surah, 10);
  const ayahStart = parseInt(searchParams.get("ayahStart") || "1", 10);
  const ayahEnd = parseInt(searchParams.get("ayahEnd") || "999", 10);

  try {
    const recitations = getRecitations(reciterId, surahNum, ayahStart, ayahEnd);
    return NextResponse.json(recitations);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
