import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getQfOAuthConfig,
  getRedirectUri,
} from "@/lib/qf-oauth";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3009";

  if (error) {
    const desc = searchParams.get("error_description") || error;
    return NextResponse.redirect(`${appBase}?qf_error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appBase}?qf_error=missing_params`);
  }

  // Read OAuth session from cookie (works across serverless Lambdas)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("qf_oauth_session");
  if (!sessionCookie) {
    return NextResponse.redirect(`${appBase}?qf_error=session_expired`);
  }

  let session: { state: string; codeVerifier: string };
  try {
    session = JSON.parse(sessionCookie.value);
  } catch {
    return NextResponse.redirect(`${appBase}?qf_error=invalid_session`);
  }

  if (session.state !== state) {
    return NextResponse.redirect(`${appBase}?qf_error=invalid_state`);
  }

  const { codeVerifier } = session;

  // Exchange code for tokens
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

  // Set tokens in httpOnly cookies
  const isSecure = appBase.startsWith("https");
  const response = NextResponse.redirect(`${appBase}?qf_connected=true`);

  // Clear the OAuth session cookie
  response.cookies.delete("qf_oauth_session");

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

  if (tokens.id_token) {
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
