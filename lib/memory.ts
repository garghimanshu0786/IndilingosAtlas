import type { Grade, OutcomeId, Scene } from "./scenes";

type TurnNote = {
  transcript: string;
  grade: Grade;
  outcome: OutcomeId;
  npcReply: string;
  stepId: string;
};

const MAX_TURNS = 8;
const sessions = new Map<string, TurnNote[]>();

export function memoryKey(sceneId: string, sessionId?: string): string {
  return `${sceneId}:${sessionId?.trim() || "anon"}`;
}

export function loadMemory(key: string, scene?: Scene): string {
  const turns = sessions.get(key);
  if (!turns?.length) return "";

  const landed = turns.filter((t) => t.grade === "right");
  const completed = landed.map((t) => t.transcript);
  const mistakes = turns
    .filter((t) => t.grade !== "right")
    .map((t) => `${t.transcript} (${t.grade})`);
  const corrections = turns
    .filter((t) => t.grade !== "right")
    .map((t) => t.npcReply);
  const lastRight = landed.at(-1);
  const current =
    scene && lastRight
      ? (scene.steps[scene.steps.findIndex((s) => s.id === lastRight.stepId) + 1] ??
        scene.steps[scene.steps.length - 1])
      : scene?.steps[0];

  const recent = turns
    .slice(-6)
    .map((t) => `heard="${t.transcript}" you="${t.npcReply}" ${t.grade}→${t.outcome}`)
    .join("\n");

  const block = [
    "[LESSON PROGRESS — treat this as ground truth, do NOT re-teach completed items]",
    completed.length ? `✓ Words FULLY COMPLETED (do NOT re-introduce): ${completed.join(" | ")}` : "",
    current ? `→ CURRENT STEP: ${current.id} (${current.goal})` : "",
    mistakes.length ? `Student mistakes to watch for: ${mistakes.join("; ")}` : "",
    corrections.length ? `Corrections already given: ${corrections.join(" | ")}` : "",
    `Turns so far: ${turns.length}`,
    `Recent conversation:\n${recent}`,
    "[END LESSON PROGRESS]",
  ]
    .filter(Boolean)
    .join("\n");

  return block.slice(0, 2200);
}

export function remember(
  key: string,
  turn: {
    transcript: string;
    grade: Grade;
    outcome: OutcomeId;
    npcReply: string;
    stepId: string;
  },
): void {
  const prev = sessions.get(key) ?? [];
  prev.push({
    transcript: turn.transcript.slice(0, 160),
    grade: turn.grade,
    outcome: turn.outcome,
    npcReply: turn.npcReply.slice(0, 160),
    stepId: turn.stepId,
  });
  sessions.set(key, prev.slice(-MAX_TURNS));
}
