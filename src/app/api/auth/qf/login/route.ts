import { NextResponse } from "next/server";
import {
  getQfOAuthConfig,
  generatePkcePair,
  randomString,
  getRedirectUri,
} from "@/lib/qf-oauth";

export async function GET(): Promise<NextResponse> {
  const { authBaseUrl, clientId } = getQfOAuthConfig();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = randomString(16);
  const redirectUri = getRedirectUri();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "offline_access bookmark",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${authBaseUrl}/oauth2/auth?${params.toString()}`;
  const isSecure = redirectUri.startsWith("https");

  const response = NextResponse.redirect(authUrl);

  // Store state + codeVerifier in httpOnly cookie (survives serverless Lambda boundaries)
  response.cookies.set("qf_oauth_session", JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
