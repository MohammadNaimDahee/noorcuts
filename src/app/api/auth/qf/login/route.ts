import { NextResponse } from "next/server";
import {
  getQfOAuthConfig,
  generatePkcePair,
  randomString,
  getRedirectUri,
  storeOAuthSession,
} from "@/lib/qf-oauth";

export async function GET(): Promise<NextResponse> {
  const { authBaseUrl, clientId } = getQfOAuthConfig();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = randomString(16);
  const nonce = randomString(16);
  const redirectUri = getRedirectUri();

  // Store session for validation on callback
  storeOAuthSession(state, nonce, codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid offline_access user collection bookmark",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${authBaseUrl}/oauth2/auth?${params.toString()}`;
  return NextResponse.redirect(authUrl);
}
