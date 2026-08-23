import { getDistrict } from "./district";
import { getJwt } from "./streetSession";

const seeds = new Map<string, Promise<Blob>>();
const SEED_CACHE = "indilingo-seeds-v1";

async function fromDisk(src: string): Promise<Blob | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SEED_CACHE);
    const hit = await cache.match(src);
    return hit ? hit.blob() : null;
  } catch {
    return null;
  }
}

async function toDisk(src: string, res: Response) {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(SEED_CACHE);
    await cache.put(src, res);
  } catch {
    
  }
}

async function loadSeed(src: string): Promise<Blob> {
  const disk = await fromDisk(src);
  if (disk) return disk;
  const res = await fetch(src, { cache: "force-cache" });
  if (!res.ok) throw new Error("Seed image missing.");
  await toDisk(src, res.clone());
  return res.blob();
}

export function prefetchSeed(src: string): Promise<Blob> {
  let hit = seeds.get(src);
  if (!hit) {
    hit = loadSeed(src);
    seeds.set(src, hit);
  }
  return hit;
}

export function warmStreet(districtId: string) {
  void getJwt();
  const district = getDistrict(districtId);
  if (district) void prefetchSeed(district.seedImage);
}
