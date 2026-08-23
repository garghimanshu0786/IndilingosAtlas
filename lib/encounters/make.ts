import type { Grade, Line, OutcomeId, Step } from "../scenes/types";

export function line(native: string, roman: string, hint: string): Line {
  return { native, roman, hint };
}

export function step(spec: {
  id: string;
  goal: string;
  tryLine: string;
  tryNative: string;
  successOutcome: OutcomeId;
  rightAny: readonly string[];
  almostAny: readonly string[];
  rightAlso?: readonly string[];
  replies: Record<Grade, Line>;
}): Step {
  return spec;
}
