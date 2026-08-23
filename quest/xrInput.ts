
export type PadAxes = { x: number; y: number; lookX: number; lookY: number };

const empty: PadAxes = { x: 0, y: 0, lookX: 0, lookY: 0 };
let pad: PadAxes = empty;

export function xrPadAxes(): PadAxes {
  return pad;
}

export function clearXrPadAxes() {
  pad = empty;
}

export function pollXrInputSources(session: XRSession) {
  let walk = { ...empty };
  let look = { x: 0, y: 0 };
  let sawLeft = false;
  let sawRight = false;

  for (const src of session.inputSources) {
    const ax = src.gamepad?.axes;
    if (!ax?.length) continue;
    const stick = readThumbstick(ax);
    if (src.handedness === "right") {
      look = stick;
      sawRight = true;
    } else {
      walk = { x: stick.x, y: stick.y, lookX: 0, lookY: 0 };
      sawLeft = true;
    }
  }
  if (!sawLeft && !sawRight && session.inputSources.length > 0) {
    const ax = session.inputSources[0]?.gamepad?.axes;
    if (ax?.length) {
      const stick = readThumbstick(ax);
      walk = { x: stick.x, y: stick.y, lookX: 0, lookY: 0 };
    }
  }

  pad = { x: walk.x, y: walk.y, lookX: look.x, lookY: look.y };
}

function readThumbstick(ax: readonly number[]) {
  const a = Math.hypot(ax[0] ?? 0, ax[1] ?? 0);
  const b = ax.length > 3 ? Math.hypot(ax[2] ?? 0, ax[3] ?? 0) : 0;
  if (b > a) return { x: ax[2] ?? 0, y: ax[3] ?? 0 };
  return { x: ax[0] ?? 0, y: ax[1] ?? 0 };
}
