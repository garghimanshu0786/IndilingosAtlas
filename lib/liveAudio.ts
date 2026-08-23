import { unlockPlayback } from "./speech";

const OUT_RATE = 24_000;

let play: AudioContext | null = null;
let cap: AudioContext | null = null;
let micOk = false;

function resume(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function streetPlayContext() {
  if (typeof window === "undefined") return null;
  if (!play || play.state === "closed") play = new AudioContext({ sampleRate: OUT_RATE });
  return resume(play);
}

export function streetCapContext() {
  if (typeof window === "undefined") return null;
  if (!cap || cap.state === "closed") cap = new AudioContext();
  return resume(cap);
}

export function micReady() {
  return micOk;
}

export async function primeStreetAudio(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  unlockPlayback();
  streetPlayContext();
  streetCapContext();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    micOk = true;
    return true;
  } catch {
    micOk = false;
    return false;
  }
}
