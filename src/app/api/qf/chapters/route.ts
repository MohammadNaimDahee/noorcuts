import { NextResponse } from "next/server";
import { getChapters } from "@/lib/qf-content";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || undefined;

  try {
    const chapters = await getChapters(language);
    return NextResponse.json({ chapters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
