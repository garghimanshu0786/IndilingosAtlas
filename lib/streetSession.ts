import { jwtHint, worldLog } from "./worldLog";

let cached: string | null = null;
let inflight: Promise<string> | null = null;
let fresh = true;

export function bustJwt() {
  worldLog("jwt bust");
  cached = null;
  inflight = null;
  fresh = true;
}

export function getJwt(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  const url = fresh ? "/api/v1/street/token?fresh=1" : "/api/v1/street/token";
  worldLog("jwt fetch", url);
  fresh = false;
  inflight = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      const body = (await res.json().catch(() => ({}))) as { jwt?: string; error?: string };
      if (!res.ok || !body.jwt) {
        worldLog("jwt fail", res.status, body.error);
        throw new Error(body.error ?? "Could not open a street session.");
      }
      cached = body.jwt;
      worldLog("jwt ok", jwtHint(body.jwt));
      return body.jwt;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
