"use client";

import { useCallback, useEffect, useRef } from "react";
import { lingbotPrompt, type District, type Encounter } from "@/lib/district";
import { worldLog } from "@/lib/worldLog";
import { currentXrSession } from "./cinema";
import { registerDriveTick, runDriveTick, unregisterDriveTick } from "./driveLoop";
import { xrPadAxes } from "./xrInput";

export type Move = "idle" | "forward" | "back" | "strafe_left" | "strafe_right";
export type LookH = "idle" | "left" | "right";
export type LookV = "idle" | "up" | "down";

const STICK_WALK = 0.28;

type Drive = {
  setMovement: (p: { movement: Move }) => Promise<unknown> | unknown;
  setLookHorizontal: (p: { look_horizontal: LookH }) => Promise<unknown> | unknown;
  setLookVertical: (p: { look_vertical: LookV }) => Promise<unknown> | unknown;
  ready: () => boolean;
};

type HeadLook = { h: LookH; v: LookV };

type PromptSync = {
  setPrompt: (p: { prompt: string }) => Promise<unknown> | unknown;
  isLive: () => boolean;
  isNear: () => boolean;
  district: District;
  getPlace: () => Encounter;
  promptPulse: React.MutableRefObject<number>;
  lastPrompt: React.MutableRefObject<string | null>;
};

export function useQuestDrive(
  drive: Drive,
  stick: { x: number; y: number },
  headLook: React.MutableRefObject<HeadLook>,
  promptSync: PromptSync | null,
  sessionKey: string | null,
) {
  const lastMove = useRef<Move>("idle");
  const lastLookH = useRef<LookH>("idle");
  const lastLookV = useRef<LookV>("idle");
  const driveRef = useRef(drive);
  driveRef.current = drive;
  const stickRef = useRef(stick);
  stickRef.current = stick;
  const headRef = useRef(headLook);
  headRef.current = headLook;
  const promptRef = useRef(promptSync);
  promptRef.current = promptSync;

  useEffect(() => {
    lastMove.current = "idle";
    lastLookH.current = "idle";
    lastLookV.current = "idle";
  }, [sessionKey]);

  useEffect(() => {
    const step = () => {
      const pad = readQuestAxes();
      const usePad = Math.abs(pad.x) > 0.12 || Math.abs(pad.y) > 0.12;
      const x = usePad ? pad.x : stickRef.current.x;
      const y = usePad ? pad.y : stickRef.current.y;
      const move = moveFromStick(x, y);
      const head = headRef.current.current;
      const stickLookH: LookH =
        pad.lookX < -0.4 ? "left" : pad.lookX > 0.4 ? "right" : "idle";
      const stickLookV: LookV =
        pad.lookY < -0.4 ? "up" : pad.lookY > 0.4 ? "down" : "idle";
      const lookH: LookH = stickLookH !== "idle" ? stickLookH : head.h;
      const lookV: LookV = stickLookV !== "idle" ? stickLookV : head.v;
      const cmd = driveRef.current;
      if (cmd.ready()) {
        if (move !== lastMove.current) {
          lastMove.current = move;
          worldLog("quest move", move);
          void cmd.setMovement({ movement: move });
          const sync = promptRef.current;
          if (sync?.isLive()) {
            const walking = move !== "idle";
            const next = lingbotPrompt(
              sync.district,
              sync.getPlace(),
              !walking && sync.isNear(),
              false,
              sync.promptPulse.current,
            );
            if (next !== sync.lastPrompt.current) {
              sync.lastPrompt.current = next;
              void sync.setPrompt({ prompt: next });
            }
          }
        }
        if (lookH !== lastLookH.current) {
          lastLookH.current = lookH;
          worldLog("quest look H", lookH);
          void cmd.setLookHorizontal({ look_horizontal: lookH });
        }
        if (lookV !== lastLookV.current) {
          lastLookV.current = lookV;
          worldLog("quest look V", lookV);
          void cmd.setLookVertical({ look_vertical: lookV });
        }
      }
    };

    registerDriveTick(step);

    let raf = 0;
    const panelLoop = () => {
      if (!currentXrSession()) runDriveTick();
      raf = window.requestAnimationFrame(panelLoop);
    };
    raf = window.requestAnimationFrame(panelLoop);

    return () => {
      unregisterDriveTick();
      window.cancelAnimationFrame(raf);
    };
  }, []);

  const resetDrive = useCallback(() => {
    lastMove.current = "idle";
    lastLookH.current = "idle";
    lastLookV.current = "idle";
  }, []);

  return { lastMove, lastLookH, lastLookV, resetDrive };
}

export function moveFromStick(x: number, y: number): Move {
  if (y < -STICK_WALK) return "forward";
  if (y > STICK_WALK) return "back";
  if (x < -STICK_WALK) return "strafe_left";
  if (x > STICK_WALK) return "strafe_right";
  return "idle";
}

export function readQuestAxes() {
  const session = currentXrSession();
  if (session) return xrPadAxes();

  const empty = { x: 0, y: 0, lookX: 0, lookY: 0 };
  const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() ?? [] : [];
  for (const pad of pads) {
    if (!pad?.axes?.length) continue;
    const ax = pad.axes;
    const left = readThumbstick(ax);
    const right =
      ax.length >= 4 ? { x: ax[2] ?? 0, y: ax[3] ?? 0 } : { x: 0, y: 0 };
    if (Math.hypot(left.x, left.y, right.x, right.y) < 0.06) continue;
    return { x: left.x, y: left.y, lookX: right.x, lookY: right.y };
  }
  return empty;
}

function readThumbstick(ax: readonly number[]) {
  const a = Math.hypot(ax[0] ?? 0, ax[1] ?? 0);
  const b = ax.length > 3 ? Math.hypot(ax[2] ?? 0, ax[3] ?? 0) : 0;
  if (b > a) return { x: ax[2] ?? 0, y: ax[3] ?? 0 };
  return { x: ax[0] ?? 0, y: ax[1] ?? 0 };
}
