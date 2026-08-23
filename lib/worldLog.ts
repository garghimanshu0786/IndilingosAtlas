type Line = { id: number; t: number; msg: string };

const MAX = 24;
const lines: Line[] = [];
const listeners = new Set<(next: Line[]) => void>();
let seq = 0;

export function worldLog(...parts: unknown[]) {
  const msg = parts
    .map((part) => {
      if (part instanceof Error) return part.message;
      if (typeof part === "string") return part;
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .join(" ");
  const row = { id: ++seq, t: Date.now(), msg };
  lines.push(row);
  if (lines.length > MAX) lines.shift();
  console.log("[indilingo]", ...parts);
  for (const listen of listeners) listen([...lines]);
}

export function worldLogs(): Line[] {
  return [...lines];
}

export function onWorldLog(listen: (next: Line[]) => void) {
  listeners.add(listen);
  listen([...lines]);
  return () => {
    listeners.delete(listen);
  };
}

export function jwtHint(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return { len: token.length, claims: null };
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return {
      len: token.length,
      models: json?.authorization_details?.[0]?.resources?.models ?? json?.models ?? null,
      max: json?.authorization_details?.[0]?.constraints?.max_sessions ?? null,
      exp: json?.exp ?? null,
    };
  } catch {
    return { len: token.length, claims: "unreadable" };
  }
}
