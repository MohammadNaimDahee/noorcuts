import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const surah = searchParams.get("surah");
  const ayahStart = searchParams.get("ayahStart");
  const ayahEnd = searchParams.get("ayahEnd");

  const { getSurahList, getAyahRange } = await import("@/lib/quran");

  // If no surah specified, return surah list
  if (!surah) {
    return NextResponse.json(getSurahList());
  }

  const surahNum = parseInt(surah, 10);
  if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
    return NextResponse.json({ error: "Invalid surah number" }, { status: 400 });
  }

  const start = ayahStart ? parseInt(ayahStart, 10) : 1;
  const end = ayahEnd ? parseInt(ayahEnd, 10) : 999;

  return NextResponse.json(getAyahRange(surahNum, start, end));
}
