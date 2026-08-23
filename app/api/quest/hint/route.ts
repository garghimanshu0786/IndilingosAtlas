import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure = forwarded ? forwarded === "https" : host.startsWith("localhost");
  const scheme = secure ? "https" : "http";
  return NextResponse.json({
    quest: `${scheme}://${host}/quest`,
    secure,
    hint: secure
      ? "Mic and Enter VR are allowed on this URL."
      : "Use HTTPS for mic and Enter VR. Run: npx next dev --experimental-https -H 0.0.0.0",
  });
}
