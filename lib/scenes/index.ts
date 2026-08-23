import { allScenes } from "../district";
import { delhiTapri } from "./delhi-tapri";
import { tokyoRamen } from "./tokyo-ramen";
import type { Scene } from "./types";

export const SCENES: Scene[] = [...allScenes(), delhiTapri, tokyoRamen];

const BY_ID = new Map(SCENES.map((scene) => [scene.id, scene]));

export function getScene(id: string | undefined | null): Scene | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function isSceneId(id: string): boolean {
  return BY_ID.has(id);
}

export type { Grade, OutcomeId, Scene, Step } from "./types";
export { isOutcome, scenePrompt } from "./types";
