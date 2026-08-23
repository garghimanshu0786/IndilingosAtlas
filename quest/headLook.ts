

export type HeadLook = { h: "idle" | "left" | "right"; v: "idle" | "up" | "down" };

const TURN_VEL_RAD = 0.014; // ~0.8°/frame at 90Hz — active head turn
const PITCH_VEL_RAD = 0.012;

let lastYaw: number | null = null;
let lastPitch: number | null = null;
let baseYaw: number | null = null;

export function resetHeadLookCalibration() {
  lastYaw = null;
  lastPitch = null;
  baseYaw = null;
}

export function headLookFromPose(pose: XRViewerPose | undefined): HeadLook {
  if (!pose) return { h: "idle", v: "idle" };

  const yaw = yawRad(pose);
  const pitch = pitchRad(pose);

  if (baseYaw === null) {
    baseYaw = yaw;
    lastYaw = yaw;
    lastPitch = pitch;
    return { h: "idle", v: "idle" };
  }

  const dyaw = wrapRad(yaw - (lastYaw ?? yaw));
  const dpitch = pitch - (lastPitch ?? pitch);
  lastYaw = yaw;
  lastPitch = pitch;
  const turnRight = dyaw > TURN_VEL_RAD;
  const turnLeft = dyaw < -TURN_VEL_RAD;

  let h: HeadLook["h"] = "idle";
  if (turnRight) h = "right";
  else if (turnLeft) h = "left";
  let v: HeadLook["v"] = "idle";
  if (dpitch > PITCH_VEL_RAD) v = "down";
  else if (dpitch < -PITCH_VEL_RAD) v = "up";

  return { h, v };
}

function yawRad(pose: XRViewerPose): number {
  const { x, y, z, w } = pose.transform.orientation;
  return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + z * z));
}

function pitchRad(pose: XRViewerPose): number {
  const { x, y, z, w } = pose.transform.orientation;
  const sinp = 2 * (w * x - y * z);
  return Math.abs(sinp) >= 1 ? Math.sign(sinp) * (Math.PI / 2) : Math.asin(sinp);
}

function wrapRad(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
