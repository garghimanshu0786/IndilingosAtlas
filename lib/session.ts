export function readStoredFocus(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("indilingo-focus");
}

export function storeFocus(id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem("indilingo-focus", id);
}

export function readLessonId(sceneId: string): string {
  if (typeof window === "undefined") return freshId();
  const stored = window.sessionStorage.getItem(`indilingo-lesson:${sceneId}`);
  if (stored) return stored;
  const next = freshId();
  window.sessionStorage.setItem(`indilingo-lesson:${sceneId}`, next);
  return next;
}

export function resetLessonId(sceneId: string): string {
  const next = freshId();
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(`indilingo-lesson:${sceneId}`, next);
  }
  return next;
}

function freshId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `lesson-${Date.now()}`;
}
