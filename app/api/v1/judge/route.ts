import { indilingoFetch } from "@/lib/env";
import { coerceJudge, localJudge, type JudgeRequest } from "@/lib/judge";
import { getScene } from "@/lib/scenes";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as (JudgeRequest & { sessionId?: string }) | null;
  if (!payload?.transcript?.trim() || !payload.sceneId) {
    return Response.json({ error: "Need a transcript." }, { status: 400 });
  }

  const scene = getScene(payload.sceneId);
  if (!scene) {
    return Response.json({ error: "Unknown street." }, { status: 400 });
  }

  try {
    const upstream = await indilingoFetch("/v1/judge", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (upstream.ok) {
      const raw = await upstream.json();
      const judged = coerceJudge(scene, raw, payload, "indilingo");
      if (judged) return Response.json(judged);
    }
  } catch {
    /* local fallback */
  }

  return Response.json(localJudge(scene, payload));
}
