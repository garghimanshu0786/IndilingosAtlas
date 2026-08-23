import { indilingoFetch } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.has("fresh");
  const path = fresh ? "/v1/street/token?fresh=1" : "/v1/street/token";
  try {
    const upstream = await indilingoFetch(path, { method: "GET" });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Street token failed." },
      { status: 502 },
    );
  }
}
