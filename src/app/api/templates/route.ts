import { NextResponse } from "next/server";
import { getTemplates } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getTemplates());
}
