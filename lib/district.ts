import { FAST2, type ScenarioKey } from "./fast2";
import type { LookId } from "./look";
import type { OutcomeId, Scene, Step } from "./scenes/types";
import { delhiEncounters } from "./encounters/delhi";
import { tokyoEncounters } from "./encounters/tokyo";
import { skyOf, walkSky } from "./sky";

export type Vec = { x: number; z: number };

export type Encounter = {
  key: ScenarioKey;
  speaker: string;
  x: number;
  z: number;
  view: string;
  opening: { native: string; roman: string };
  heritage: { title: string; native: string; body: string };
  impatient: { native: string; roman: string };
  claude: { npc: string; replyShape: string };
  steps: Step[];
};

export type District = {
  id: string;
  city: string;
  language: string;
  locale: string;
  font: "deva" | "jp";
  seedImage: string;
  identity: string;
  encounters: Encounter[];
};

export const DISTRICTS: District[] = [
  {
    id: "delhi",
    city: "Delhi",
    language: "Hindi",
    locale: "hi-IN",
    font: "deva",
    seedImage: "/scenes/delhi-street.jpg",
    identity: [
      "A first-person video of this Delhi street in clear late-morning light.",
      "Near, mid, and far layers. Do not crop to a face.",
      "A living district: tapri, sabzi carts, autos, a bus, a school gate, a clinic.",
      "Photoreal daylight. Not rainy night.",
    ].join(" "),
    encounters: delhiEncounters,
  },
  {
    id: "tokyo",
    city: "Tokyo",
    language: "Japanese",
    locale: "ja-JP",
    font: "jp",
    seedImage: "/scenes/tokyo-street.jpg",
    identity: [
      "A first-person video of this Tokyo street in clear late-morning light.",
      "Near, mid, and far layers. Do not crop to a face.",
      "A living district: yatai, yaoya, taxi, bus, koban, kissaten, school gate, clinic.",
      "Photoreal daylight. Not rainy night.",
    ].join(" "),
    encounters: tokyoEncounters,
  },
];

export function getDistrict(id: string | undefined | null): District | undefined {
  if (!id) return undefined;
  return DISTRICTS.find((d) => d.id === id);
}

export function catalogOf(key: ScenarioKey) {
  return FAST2.find((item) => item.key === key)!;
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function nearestEncounter(district: District, pos: Vec): { place: Encounter; range: number } {
  let best = district.encounters[0];
  let range = dist(pos, best);
  for (const place of district.encounters) {
    const d = dist(pos, place);
    if (d < range) {
      best = place;
      range = d;
    }
  }
  return { place: best, range };
}

export function asScene(district: District, place: Encounter): Scene {
  const meta = catalogOf(place.key);
  return {
    id: `${district.id}:${place.key}`,
    city: district.city,
    speaker: place.speaker,
    language: district.language,
    locale: district.locale,
    nativeTitle: meta.label,
    deckLine: meta.description,
    seedImage: district.seedImage,
    font: district.font,
    identity: `${district.identity} ${place.view}`,
    beats: {
      idle: place.view,
      welcome: `${place.view} The person warms and nods the guest in.`,
      confused: `${place.view} The person leans in, not following, asking them to say it again.`,
      almost: `${place.view} The person almost understands, waiting for a clearer line.`,
      served: `${place.view} The task moves forward. The person acts on the request.`,
      extra: `${place.view} The person adds a small extra, satisfied.`,
      paid: `${place.view} Money or papers change hands. A small nod.`,
      impatient: `${place.view} The person glances at the street, waiting, a little tired.`,
      complete: `${place.view} The beat ends warm. The district still lives behind them.`,
    },
    opening: place.opening,
    heritage: place.heritage,
    impatient: place.impatient,
    steps: place.steps,
    claude: place.claude,
  };
}

export function allScenes(): Scene[] {
  return DISTRICTS.flatMap((district) => district.encounters.map((place) => asScene(district, place)));
}

function lookLine(look: LookId, toward?: string): string {
  if (look === "forward") {
    return toward
      ? `Looking down the street toward ${toward}, still wide.`
      : "Looking down the open street, still wide.";
  }
  if (look === "back") return "More of the walkable district in frame, still wide.";
  if (look === "left") return "The left side of the block, still a wide shot.";
  if (look === "right") {
    return toward
      ? `The right side of the block toward ${toward}, still wide, not a portrait.`
      : "The right side of the block, still wide, not a portrait.";
  }
  return toward
    ? `${toward} in the mid-ground. First-person chest height.`
    : "First-person chest height, vanishing point down the block.";
}

const CLEAN = [
  "Photoreal street photography, same materials as the first frame. No title card, no caption, no watermark, no English banner across the road.",
  "Photoreal daylight, same asphalt and plaster as the first frame. No title, no caption, no watermark, no banner painted on the street.",
] as const;

export function lingbotPrompt(
  district: District,
  place: Encounter,
  near: boolean,
  speaking: boolean,
  pulse = 0,
  arrive = false,
): string {
  const sky = near || arrive ? skyOf(district.id, place.key) : walkSky(district.id);
  const city = district.id === "tokyo" ? "Tokyo" : "Delhi";
  const stall = place.view.replace(/^Mid:\s*/i, "");
  if (arrive) {
    const label = catalogOf(place.key).label;
    return [
      `A first-person video of this ${city} street, ${sky.when}.`,
      `The camera has arrived at ${place.speaker}'s ${label}. This place now fills the mid-ground.`,
      `Near: ${sky.near}.`,
      `Mid: ${stall} ${place.speaker} faces you at speaking distance. The previous stall is gone.`,
      `Far: ${sky.far}.`,
      sky.air,
      "Same photoreal street as the first frame. No title card, no caption, no watermark, no English banner.",
    ].join(" ");
  }
  const mid = near
    ? `${stall} ${place.speaker} stands in the mid-ground, facing you.${speaking ? ` ${place.speaker} is speaking.` : ""} The rest of this street from the first frame stays in place`
    : "stalls, parked vehicles, and open doorways along both sides";
  return [
    `A first-person video of this ${city} street, ${sky.when}.`,
    `Near: ${sky.near}.`,
    `Mid: ${mid}.`,
    `Far: ${sky.far}.`,
    sky.air,
    CLEAN[pulse % CLEAN.length],
  ].join(" ");
}

export function walkPrompt(district: District, look: LookId, pos: Vec): string {
  const sky = walkSky(district.id);
  return `${district.identity} ${sky.when} at stretch ${pos.x.toFixed(0)},${pos.z.toFixed(0)}. ${sky.air} ${lookLine(look)}`;
}

export function districtPrompt(
  district: District,
  place: Encounter,
  outcome: OutcomeId,
  look: LookId,
  speaking: boolean,
  pos: Vec,
  near: boolean,
): string {
  if (!near) return walkPrompt(district, look, pos);
  const speak = speaking
    ? ` ${place.speaker} is speaking to the camera, mouth moving naturally. One change only: speech.`
    : "";
  const scene = asScene(district, place);
  return `${district.identity} ${scene.beats[outcome]} ${lookLine(look, place.speaker)}${speak}`;
}
