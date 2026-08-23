export const LOOKS = ["idle", "forward", "back", "left", "right"] as const;
export type LookId = (typeof LOOKS)[number];

export const LOOK_BEAT: Record<LookId, string> = {
  idle: "Keep the wide street shot. Chest-height, the road open to the vanishing point, the stall mid-ground, clear daylight.",
  forward:
    "Same district, same people. Looking farther down the street toward the stall, still wide, still daylight.",
  back: "Same district, same people. More of the walkable block in frame, still wide, daylight.",
  left: "Same district, same people. The left street wall, still a wide shot, daylight.",
  right:
    "Same district, same people. Toward the stall, still wide, not a portrait, daylight.",
};

export function isLook(value: string): value is LookId {
  return (LOOKS as readonly string[]).includes(value);
}
