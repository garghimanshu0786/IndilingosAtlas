import { isOutcome, type Grade, type OutcomeId, type Scene } from "./scenes";

export type JudgeRequest = {
  sceneId: string;
  transcript: string;
  stepId: string;
  failStreak: number;
};

export type JudgeResult = {
  outcome: OutcomeId;
  grade: Grade;
  npcReply: string;
  npcRoman: string;
  hintEn: string;
  stepId: string;
  complete: boolean;
  source: "indilingo" | "local";
};

function fold(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, needles: readonly string[]): boolean {
  return needles.some((n) => text.includes(n.toLowerCase()));
}

function gradeStep(scene: Scene, stepId: string, spoken: string): Grade {
  const step = scene.steps.find((s) => s.id === stepId) ?? scene.steps[0];
  const t = fold(spoken);
  if (!t) return "wrong";
  const rightHit = hasAny(t, step.rightAny);
  const alsoHit = !step.rightAlso || hasAny(t, step.rightAlso);
  if (rightHit && alsoHit) return "right";
  if (rightHit || hasAny(t, step.almostAny)) return "almost";
  return "wrong";
}

function outcomeFor(scene: Scene, stepId: string, grade: Grade, failStreak: number): OutcomeId {
  const step = scene.steps.find((s) => s.id === stepId) ?? scene.steps[0];
  if (grade === "wrong" && failStreak >= 1) return "impatient";
  if (grade === "almost") return "almost";
  if (grade === "wrong") return "confused";
  return step.successOutcome;
}

function nextStepId(scene: Scene, stepId: string): string | null {
  const i = scene.steps.findIndex((s) => s.id === stepId);
  return scene.steps[i + 1]?.id ?? null;
}

export function localJudge(scene: Scene, input: JudgeRequest): JudgeResult {
  const step = scene.steps.find((s) => s.id === input.stepId) ?? scene.steps[0];
  const grade = gradeStep(scene, step.id, input.transcript);
  const outcome = outcomeFor(scene, step.id, grade, input.failStreak);
  const last = scene.steps[scene.steps.length - 1];
  const copy =
    outcome === "impatient"
      ? {
          native: scene.impatient.native,
          roman: scene.impatient.roman,
          hint: step.replies.wrong.hint,
        }
      : step.replies[grade];
  const complete = grade === "right" && step.id === last.id;
  const advanced = grade === "right" ? nextStepId(scene, step.id) : step.id;

  return {
    outcome,
    grade,
    npcReply: copy.native,
    npcRoman: copy.roman,
    hintEn: copy.hint,
    stepId: complete ? step.id : (advanced ?? step.id),
    complete,
    source: "local",
  };
}

export function coerceJudge(
  scene: Scene,
  raw: unknown,
  fallback: JudgeRequest,
  source: JudgeResult["source"] = "local",
): JudgeResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const outcome = typeof o.outcome === "string" ? o.outcome : "";
  const grade = o.grade;
  const stepId = typeof o.stepId === "string" ? o.stepId : fallback.stepId;
  const knownStep = scene.steps.some((s) => s.id === stepId);
  if (!isOutcome(outcome) || !knownStep) return null;
  if (grade !== "wrong" && grade !== "almost" && grade !== "right") return null;
  if (typeof o.npcReply !== "string" || typeof o.hintEn !== "string") return null;
  const last = scene.steps[scene.steps.length - 1];
  return {
    outcome,
    grade,
    npcReply: o.npcReply,
    npcRoman: typeof o.npcRoman === "string" ? o.npcRoman : "",
    hintEn: o.hintEn,
    stepId,
    complete: o.complete === true || (grade === "right" && fallback.stepId === last.id),
    source,
  };
}
