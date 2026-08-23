import { LOOK_BEAT, type LookId } from "../look";

export const OUTCOMES = [
  "idle",
  "welcome",
  "confused",
  "almost",
  "served",
  "extra",
  "paid",
  "impatient",
  "complete",
] as const;

export type OutcomeId = (typeof OUTCOMES)[number];

export type Grade = "wrong" | "almost" | "right";

export type Line = {
  native: string;
  roman: string;
  hint: string;
};

export type Step = {
  id: string;
  goal: string;
  tryLine: string;
  tryNative: string;
  successOutcome: OutcomeId;
  rightAny: readonly string[];
  rightAlso?: readonly string[];
  almostAny: readonly string[];
  replies: Record<Grade, Line>;
};

export type Scene = {
  id: string;
  city: string;
  speaker: string;
  language: string;
  locale: string;
  nativeTitle: string;
  deckLine: string;
  seedImage: string;
  identity: string;
  beats: Record<OutcomeId, string>;
  opening: { native: string; roman: string };
  heritage: { title: string; native: string; body: string };
  impatient: Omit<Line, "hint">;
  font: "deva" | "jp";
  steps: Step[];
  claude: {
    npc: string;
    replyShape: string;
  };
};

export function scenePrompt(
  scene: Scene,
  outcome: OutcomeId,
  speaking = false,
  look: LookId = "idle",
): string {
  const speak = speaking
    ? " The person across the counter is speaking to the camera, mouth moving naturally, eyes on the guest. One change only: speech."
    : "";
  return `${scene.identity} ${scene.beats[outcome]} ${LOOK_BEAT[look]}${speak}`;
}

export function isOutcome(value: string): value is OutcomeId {
  return (OUTCOMES as readonly string[]).includes(value);
}
