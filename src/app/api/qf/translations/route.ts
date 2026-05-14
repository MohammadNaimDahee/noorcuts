import { NextResponse } from "next/server";
import { getTranslationResources } from "@/lib/qf-content";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || undefined;

  try {
    const translations = await getTranslationResources(language);
    return NextResponse.json({ translations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
