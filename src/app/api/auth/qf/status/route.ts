import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getQfOAuthConfig } from "@/lib/qf-oauth";

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number; refresh_token?: string } | null> {
  const { authBaseUrl, clientId, clientSecret } = getQfOAuthConfig();

  const res = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("qf_access_token")?.value;
  const refreshToken = cookieStore.get("qf_refresh_token")?.value;

  if (accessToken) {
    return NextResponse.json({ connected: true });
  }

  // Access token expired — try refresh
  if (!refreshToken) {
    return NextResponse.json({ connected: false });
  }

  const tokens = await refreshAccessToken(refreshToken);
  if (!tokens) {
    // Refresh failed — clear everything
    const response = NextResponse.json({ connected: false });
    response.cookies.delete("qf_refresh_token");
    return response;
  }

  // Set new cookies
  const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3009";
  const isSecure = appBase.startsWith("https");
  const response = NextResponse.json({ connected: true });

  response.cookies.set("qf_access_token", tokens.access_token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in || 3600,
  });

  if (tokens.refresh_token) {
    response.cookies.set("qf_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return response;
}
