import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("qf_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({ connected: true });
}
