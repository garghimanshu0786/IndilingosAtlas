import { indilingoFetch } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    const upstream = await indilingoFetch("/v1/live/session", {
      method: "POST",
      body: payload || "{}",
    });
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
      { error: err instanceof Error ? err.message : "Live session failed." },
      { status: 502 },
    );
  }
}
