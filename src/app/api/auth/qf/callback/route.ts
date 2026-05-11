import { NextResponse } from "next/server";
import {
  getQfOAuthConfig,
  getRedirectUri,
  getOAuthSession,
  deleteOAuthSession,
} from "@/lib/qf-oauth";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3009";

  if (error) {
    return NextResponse.redirect(`${appBase}?qf_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appBase}?qf_error=missing_params`);
  }

  // Validate state (CSRF protection)
  const session = getOAuthSession(state);
  if (!session) {
    return NextResponse.redirect(`${appBase}?qf_error=invalid_state`);
  }

  const { codeVerifier } = session;
  deleteOAuthSession(state);

  // Exchange code for tokens (confidential client — server-side with Basic auth)
  const { authBaseUrl, clientId, clientSecret } = getQfOAuthConfig();
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("QF token exchange failed:", tokenRes.status, errBody);
    return NextResponse.redirect(`${appBase}?qf_error=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();

  // Set tokens in httpOnly cookies (secure in production)
  const isSecure = appBase.startsWith("https");
  const response = NextResponse.redirect(`${appBase}?qf_connected=true`);

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
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
  }

  if (tokens.id_token) {
    // Store id_token for user info (sub, name, email)
    response.cookies.set("qf_id_token", tokens.id_token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.expires_in || 3600,
    });
  }

  return response;
}
