import { NextResponse } from "next/server";
import { getRecitations, getRecitationAudioFiles } from "@/lib/qf-content";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const chapter = searchParams.get("chapter");
  const recitationId = searchParams.get("recitationId");

  try {
    // If recitationId + chapter provided, return audio files for that recitation
    if (recitationId && chapter) {
      const audioFiles = await getRecitationAudioFiles(Number(recitationId), Number(chapter));
      return NextResponse.json({ audioFiles });
    }

    // Otherwise return list of available reciters
    const recitations = await getRecitations();
    return NextResponse.json({ recitations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
