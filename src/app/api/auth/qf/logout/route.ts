import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const appBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3009";
  const response = NextResponse.redirect(`${appBase}?qf_disconnected=true`, 303);

  // Clear all QF auth cookies
  response.cookies.delete("qf_access_token");
  response.cookies.delete("qf_refresh_token");
  response.cookies.delete("qf_id_token");
  response.cookies.delete("qf_oauth_session");

  return response;
}
