import crypto from "crypto";

export interface QfOAuthConfig {
  env: "prelive" | "production";
  clientId: string;
  clientSecret: string;
  authBaseUrl: string;
  apiBaseUrl: string;
}

export function getQfOAuthConfig(): QfOAuthConfig {
  const env = (process.env.QF_ENV || "prelive") as "prelive" | "production";
  const clientId = process.env.QF_CLIENT_ID;
  const clientSecret = process.env.QF_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Quran Foundation API credentials. Request access: https://api-docs.quran.foundation/request-access"
    );
  }

  const urls = env === "production"
    ? { authBaseUrl: "https://oauth2.quran.foundation", apiBaseUrl: "https://apis.quran.foundation" }
    : { authBaseUrl: "https://prelive-oauth2.quran.foundation", apiBaseUrl: "https://apis-prelive.quran.foundation" };

  return { env, clientId, clientSecret, ...urls };
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64url(hash);
  return { codeVerifier, codeChallenge };
}

export function randomString(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3009";
  return `${base}/api/auth/qf/callback`;
}

// In-memory session store for OAuth state (works for single-instance deployments)
// For production multi-instance, use a database or Redis
const oauthSessions = new Map<string, { state: string; nonce: string; codeVerifier: string; createdAt: number }>();

export function storeOAuthSession(state: string, nonce: string, codeVerifier: string): void {
  // Clean old sessions (older than 10 minutes)
  const now = Date.now();
  for (const [key, session] of oauthSessions) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      oauthSessions.delete(key);
    }
  }
  oauthSessions.set(state, { state, nonce, codeVerifier, createdAt: now });
}

export function getOAuthSession(state: string) {
  return oauthSessions.get(state) || null;
}

export function deleteOAuthSession(state: string): void {
  oauthSessions.delete(state);
}
