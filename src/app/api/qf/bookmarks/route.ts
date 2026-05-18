import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQfOAuthConfig } from "@/lib/qf-oauth";

export async function GET(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("qf_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not connected to Quran.com" }, { status: 401 });
  }

  const { apiBaseUrl, clientId } = getQfOAuthConfig();
  const { searchParams } = new URL(request.url);
  const mushafId = searchParams.get("mushafId") || "1";
  const type = searchParams.get("type") || "ayah";
  const first = searchParams.get("first") || "50";

  const params = new URLSearchParams({ mushafId, type, first });
  const after = searchParams.get("after");
  if (after) params.set("after", after);

  // Bookmarks live on the user/auth API, not the content API
  const env = process.env.QF_ENV || "production";
  const userApiBase = env === "production"
    ? "https://apis.quran.foundation"
    : "https://apis-prelive.quran.foundation";

  try {
    const res = await fetch(`${userApiBase}/auth/v1/bookmarks?${params.toString()}`, {
      headers: {
        "x-auth-token": accessToken,
        "x-client-id": clientId,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("QF bookmarks fetch failed:", res.status, errText);

      if (res.status === 401) {
        // Token expired — clear cookies
        const response = NextResponse.json({ error: "Token expired, please reconnect" }, { status: 401 });
        response.cookies.delete("qf_access_token");
        response.cookies.delete("qf_id_token");
        return response;
      }

      return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("QF bookmarks error:", err);
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 });
  }
}
