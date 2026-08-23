"use client";

import {
  LingbotMainVideoView,
  useLingbot,
  useLingbotCommandError,
  useLingbotGenerationStarted,
  useLingbotImageAccepted,
  useLingbotTrack,
} from "@reactor-models/lingbot";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  asScene,
  catalogOf,
  lingbotPrompt,
  nearestEncounter,
  type District,
  type Encounter,
  type Vec,
} from "@/lib/district";
import { type JudgeResult } from "@/lib/judge";
import { type LookId } from "@/lib/look";
import { type OutcomeId } from "@/lib/scenes";
import { bustJwt } from "@/lib/streetSession";
import { worldLog } from "@/lib/worldLog";
import { readLessonId, resetLessonId } from "@/lib/session";
import { useStreetLive } from "@/lib/streetLive";
import { primeStreetAudio } from "@/lib/liveAudio";
import { startLingbotStreet } from "@/lib/startStreet";
import { duckStreetMusic, musicPrefersOn, startStreetMusic, stopStreetMusic, storeMusicPref } from "@/lib/streetMusic";

const RANGE_IN = 1.2;
const RANGE_OUT = 1.9;
const SPEED = 3.6;
const START: Vec = { x: 5.5, z: 6.0 };

const STATUS_LINE: Record<string, string> = {
  disconnected: "Opening the street",
  connecting: "Opening the street",
  waiting: "Finding a GPU for this city",
  ready: "Opening the street",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function lookFromStick(dx: number, dy: number): LookId {
  if (Math.hypot(dx, dy) < 0.35) return "idle";
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "forward" : "back";
}

function headingDeg(look: LookId) {
  if (look === "left") return -90;
  if (look === "right") return 90;
  if (look === "back") return 180;
  return 0;
}

function radarPct(n: number) {
  return `${clamp(n, 0.4, 9.6) * 10}%`;
}

function gpuBlocked(message: string | undefined) {
  if (!message) return false;
  return /session limit|403|forbidden|not authorized|failed to create session|pollSessionReady|ice servers/i.test(message);
}

export function Stage({
  district,
  playing = true,
  onBack,
}: {
  district: District;
  playing?: boolean;
  onBack: () => void;
}) {
  const {
    status,
    sessionId,
    lastError,
    setPrompt,
    setImage,
    setMovement,
    setLookHorizontal,
    setLookVertical,
    start,
    uploadFile,
    reconnect,
  } = useLingbot();
  const videoTrack = useLingbotTrack("main_video");
  const imageWait = useRef<(() => void) | null>(null);
  const lastMove = useRef<"idle" | "forward" | "back" | "strafe_left" | "strafe_right">("idle");
  const lastLookH = useRef<"idle" | "left" | "right">("idle");
  const lastLookV = useRef<"idle" | "up" | "down">("idle");

  const cmd = useRef({ setPrompt, setImage, setMovement, setLookHorizontal, setLookVertical, start, uploadFile });
  cmd.current = { setPrompt, setImage, setMovement, setLookHorizontal, setLookVertical, start, uploadFile };
  const statusRef = useRef(status);
  statusRef.current = status;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const liveRef = useRef(false);
  const nearRef = useRef(false);
  const districtRef = useRef(district);
  districtRef.current = district;

  useLingbotImageAccepted(() => {
    worldLog("image accepted");
    imageWait.current?.();
    imageWait.current = null;
  });
  useLingbotGenerationStarted(() => {
    worldLog("generation started");
    setLive(true);
    lastMove.current = "idle";
    lastLookH.current = "idle";
    lastLookV.current = "idle";
  });
  const first = district.encounters[0];
  const placeRef = useRef(first);
  const [pos, setPos] = useState<Vec>(START);
  const [placeKey, setPlaceKey] = useState(first.key);
  const [outcome, setOutcome] = useState<OutcomeId>("idle");
  const [stepId, setStepId] = useState(first.steps[0].id);
  const [failStreak, setFailStreak] = useState(0);
  const [npc, setNpc] = useState<JudgeResult | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showType, setShowType] = useState(false);
  const [live, setLive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [look, setLook] = useState<LookId>("idle");
  const [panel, setPanel] = useState<"menu" | "settings" | "map" | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const startedFor = useRef<string | null>(null);
  const startArmed = useRef(false);
  const lastPrompt = useRef<string | null>(null);
  const promptPulse = useRef(0);
  const arriveNext = useRef(false);
  const seededPlace = useRef(first.key);
  const lessonId = useRef(readLessonId(`${district.id}:${first.key}`));
  const greetedPlace = useRef<string | null>(null);
  const silencedHere = useRef<string | null>(null);
  const [liveLine, setLiveLine] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const liveOn = useRef(false);
  const joined = useRef(false);
  const talkLock = useRef(0);
  const startRef = useRef<() => void>(() => {});
  const keys = useRef({ w: false, a: false, s: false, d: false, left: false, right: false, up: false, down: false });
  const stickVec = useRef({ x: 0, y: 0 });
  const stopCall = useRef<() => void>(() => {});

  const nearest = nearestEncounter(district, pos);
  const near = nearest.range < (placeKey === nearest.place.key ? RANGE_OUT : RANGE_IN);
  const place = district.encounters.find((item) => item.key === placeKey) ?? nearest.place;
  nearRef.current = near;
  placeRef.current = place;
  const scene = useMemo(() => asScene(district, place), [district, place]);
  const meta = catalogOf(place.key);

  const {
    available,
    active: liveCall,
    connecting: liveStarting,
    listening,
    paused: livePaused,
    interim,
    error: speechError,
    start: startCall,
    stop: hangUp,
    togglePause,
    speakFirst,
    cuePlace,
  } = useStreetLive(scene, {
    onUserText: (text) => {
      setTyped(text);
    },
    onModelText: (text) => setLiveLine(text),
    onSpeaking: setSpeaking,
  });
  startRef.current = startCall;

  const step = scene.steps.find((s) => s.id === stepId) ?? scene.steps[0];
  const streaming = Boolean(videoTrack) && live;
  const nativeFont = scene.font === "jp" ? "font-jp" : "font-deva";
  const lineNative = liveLine ?? (npc ? npc.npcReply : scene.opening.native);
  const lineRoman = liveLine ? "" : npc ? npc.npcRoman : scene.opening.roman;
  const lineEn = npc?.hintEn ?? step.goal;
  const liveBusy = liveCall || liveStarting;
  liveRef.current = live;

  useEffect(() => {
    worldLog("status", status, sessionId ? `session ${sessionId.slice(0, 8)}` : "no-session", lastError?.message ?? "ok");
  }, [lastError?.message, sessionId, status]);
  useEffect(() => {
    lastMove.current = "idle";
    lastLookH.current = "idle";
    lastLookV.current = "idle";
  }, [sessionId, status]);

  useEffect(() => {
    worldLog("video", videoTrack ? "track on" : "no track", live ? "started" : "not started");
  }, [live, videoTrack]);

  useLingbotCommandError((err) => {
    worldLog("command error", err.command, err.reason);
    setEngineError("The world missed that cue. Try the line again.");
  });

  useEffect(() => {
    stopCall.current = hangUp;
  }, [hangUp]);

  useEffect(() => {
    if (status !== "ready" || !sessionId) return;
    if (startedFor.current === sessionId) return;
    startedFor.current = sessionId;
    startArmed.current = false;
    const openingPrompt = lingbotPrompt(district, place, false, false, promptPulse.current);
    lastPrompt.current = openingPrompt;
    let cancelled = false;

    void (async () => {
      try {
        worldLog("street start", district.id, sessionId);
        await startLingbotStreet({
          seedSrc: district.seedImage,
          fileName: `${district.id}.jpg`,
          prompt: openingPrompt,
          cmd: cmd.current,
          armImageWait: (resolve) => {
            imageWait.current = resolve;
          },
          cancelled: () => cancelled,
        });
        if (!cancelled) {
          startArmed.current = true;
          setLive(true);
        }
      } catch (err) {
        worldLog("street start failed", err);
        if (!cancelled) {
          startedFor.current = null;
          startArmed.current = false;
          setEngineError(err instanceof Error ? err.message : "Could not open this street.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (!startArmed.current && startedFor.current === sessionId) {
        startedFor.current = null;
      }
    };
  }, [district.id, sessionId, status]);

  useEffect(() => {
    if (status !== "ready" || !live) return;
    const arriving = arriveNext.current;
    arriveNext.current = false;
    const walking = lastMove.current !== "idle";
    const next = lingbotPrompt(district, place, !walking && near, false, promptPulse.current, arriving && !walking);
    if (lastPrompt.current === next) return;
    lastPrompt.current = next;
    void setPrompt({ prompt: next });
  }, [district, live, near, place, setPrompt, status]);

  useEffect(() => {
    if (status !== "ready" || !live) return;
    const id = window.setInterval(() => {
      promptPulse.current += 1;
      const walking = lastMove.current !== "idle";
      const next = lingbotPrompt(district, place, !walking && near, false, promptPulse.current);
      lastPrompt.current = next;
      void setPrompt({ prompt: next });
    }, 16_000);
    return () => window.clearInterval(id);
  }, [district, live, near, place, setPrompt, status]);

  const enterPlace = useCallback((next: Encounter) => {
    if (next.key !== seededPlace.current) {
      arriveNext.current = true;
      promptPulse.current += 1;
    }
    seededPlace.current = next.key;
    setPlaceKey(next.key);
    const nextScene = asScene(district, next);
    lessonId.current = readLessonId(nextScene.id);
    setOutcome("idle");
    setStepId(next.steps[0].id);
    setFailStreak(0);
    setNpc(null);
    setTyped("");
    setLiveLine(null);
    return nextScene;
  }, [district]);

  useEffect(() => {
    if (!near) {
      greetedPlace.current = null;
      return;
    }
    if (nearest.place.key === placeKey && greetedPlace.current === nearest.place.key) return;
    greetedPlace.current = nearest.place.key;
    const nextScene = enterPlace(nearest.place);
    if (liveCall) cuePlace(nextScene);
  }, [cuePlace, enterPlace, liveCall, near, nearest.place, placeKey]);

  const lessonRef = useRef({ stepId, failStreak, pending, sceneId: scene.id });
  useEffect(() => {
    lessonRef.current = { stepId, failStreak, pending, sceneId: scene.id };
  }, [failStreak, pending, scene.id, stepId]);

  const runJudge = useCallback(async (raw: string) => {
    const transcript = raw.trim();
    if (!transcript || lessonRef.current.pending) return;
    setPending(true);
    setEngineError(null);
    try {
      const res = await fetch("/api/v1/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          sceneId: lessonRef.current.sceneId,
          stepId: lessonRef.current.stepId,
          failStreak: lessonRef.current.failStreak,
          sessionId: lessonId.current,
        }),
      });
      const body = (await res.json()) as JudgeResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not judge that line.");
      setNpc(body);
      setOutcome(body.outcome);
      setStepId(body.stepId);
      setFailStreak(body.grade === "wrong" ? lessonRef.current.failStreak + 1 : 0);
      setTyped("");
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : "Something broke.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    submitRef.current = runJudge;
  }, [runJudge]);

  useEffect(() => {
    liveOn.current = liveBusy;
  }, [liveBusy]);

  useEffect(() => {
    if (!near) silencedHere.current = null;
  }, [near]);

  const leaveTalk = useCallback(() => {
    const now = Date.now();
    if (now - talkLock.current < 700) return;
    talkLock.current = now;
    silencedHere.current = placeKey;
    liveOn.current = false;
    joined.current = false;
    worldLog("talk hangup");
    hangUp();
  }, [hangUp, placeKey]);
  useEffect(() => {
    if (!playing) return;
    if (!available) return;
    if (silencedHere.current === placeKey) return;
    if (joined.current && liveOn.current) return;
    joined.current = true;
    liveOn.current = true;
    worldLog("street join", placeKey);
    void startRef.current();
  }, [available, placeKey, playing]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const vx = (keys.current.d ? 1 : 0) - (keys.current.a ? 1 : 0) + stickVec.current.x;
      const vz = (keys.current.w ? 1 : 0) - (keys.current.s ? 1 : 0) - stickVec.current.y;
      if (vx || vz) {
        const n = Math.hypot(vx, vz) || 1;
        setPos((p) => ({
          x: clamp(p.x + (vx / n) * SPEED * dt, 0.4, 9.6),
          z: clamp(p.z + (vz / n) * SPEED * dt, 0.4, 9.6),
        }));
        setLook(lookFromStick(vx, -vz));
      } else {
        setLook((prev) => (prev === "idle" ? prev : "idle"));
      }
      const move =
        keys.current.w || stickVec.current.y < -0.35
          ? "forward"
          : keys.current.s || stickVec.current.y > 0.35
            ? "back"
            : keys.current.a || stickVec.current.x < -0.35
              ? "strafe_left"
              : keys.current.d || stickVec.current.x > 0.35
                ? "strafe_right"
                : "idle";
      if (move !== lastMove.current) {
        lastMove.current = move;
        worldLog("move", move);
        if (statusRef.current === "ready") {
          void cmd.current.setMovement({ movement: move });
          if (liveRef.current) {
            const walking = move !== "idle";
            const next = lingbotPrompt(
              districtRef.current,
              placeRef.current,
              !walking && nearRef.current,
              false,
              promptPulse.current,
            );
            if (next !== lastPrompt.current) {
              lastPrompt.current = next;
              void cmd.current.setPrompt({ prompt: next });
            }
          }
        }
      }
      const lookH = keys.current.left ? "left" : keys.current.right ? "right" : "idle";
      const lookV = keys.current.up ? "up" : keys.current.down ? "down" : "idle";
      if (lookH !== lastLookH.current) {
        lastLookH.current = lookH;
        if (statusRef.current === "ready") void cmd.current.setLookHorizontal({ look_horizontal: lookH });
      }
      if (lookV !== lastLookV.current) {
        lastLookV.current = lookV;
        if (statusRef.current === "ready") void cmd.current.setLookVertical({ look_vertical: lookV });
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const ignore = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      return Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"));
    };
    const down = (e: KeyboardEvent) => {
      if (ignore(e)) return;
      void primeStreetAudio();
      if (e.code === "Escape") {
        if (!playingRef.current) return;
        stopCall.current();
        if (panel) setPanel(null);
        else onBack();
        return;
      }
      if (e.code === "KeyM") {
        e.preventDefault();
        setPanel((p) => (p === "map" ? null : "map"));
        return;
      }
      if (e.code === "KeyP" && liveCall) {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.code === "KeyW") {
        e.preventDefault();
        keys.current.w = true;
        return;
      }
      if (e.code === "KeyS") {
        e.preventDefault();
        keys.current.s = true;
        return;
      }
      if (e.code === "KeyA") {
        e.preventDefault();
        keys.current.a = true;
        return;
      }
      if (e.code === "KeyD") {
        e.preventDefault();
        keys.current.d = true;
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        keys.current.left = true;
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        keys.current.right = true;
        return;
      }
      if (e.code === "ArrowUp") {
        e.preventDefault();
        keys.current.up = true;
        return;
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        keys.current.down = true;
        return;
      }
      if ((e.code !== "Space" && e.code !== "KeyE") || e.repeat) return;
      if (!liveCall && !liveStarting) return;
      e.preventDefault();
      leaveTalk();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyW") keys.current.w = false;
      if (e.code === "KeyS") keys.current.s = false;
      if (e.code === "KeyA") keys.current.a = false;
      if (e.code === "KeyD") keys.current.d = false;
      if (e.code === "ArrowLeft") keys.current.left = false;
      if (e.code === "ArrowRight") keys.current.right = false;
      if (e.code === "ArrowUp") keys.current.up = false;
      if (e.code === "ArrowDown") keys.current.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [leaveTalk, liveCall, liveStarting, onBack, panel, togglePause]);

  function replay() {
    lessonId.current = resetLessonId(scene.id);
    setSpeaking(false);
    setOutcome("idle");
    setStepId(scene.steps[0].id);
    setFailStreak(0);
    setNpc(null);
    setTyped("");
    setLiveLine(null);
    lastPrompt.current = lingbotPrompt(district, place, near, false, promptPulse.current, true);
    void setPrompt({ prompt: lastPrompt.current });
    if (liveCall) speakFirst(scene);
    else {
      silencedHere.current = null;
      void startCall();
    }
  }

  function goTo(next: Encounter) {
    setPos({ x: next.x, z: next.z });
    greetedPlace.current = next.key;
    silencedHere.current = null;
    const nextScene = enterPlace(next);
    setPanel(null);
    if (liveCall) cuePlace(nextScene);
    if (statusRef.current === "ready") {
      lastMove.current = "forward";
      void cmd.current.setMovement({ movement: "forward" });
      window.setTimeout(() => {
        if (keys.current.w || stickVec.current.y < -0.35) return;
        lastMove.current = "idle";
        if (statusRef.current !== "ready") return;
        void cmd.current.setMovement({ movement: "idle" });
        const arrived = lingbotPrompt(districtRef.current, next, true, false, promptPulse.current, true);
        lastPrompt.current = arrived;
        void cmd.current.setPrompt({ prompt: arrived });
      }, 900);
    }
  }

  function moveStick(clientX: number, clientY: number) {
    const el = stickRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let dx = (clientX - (box.left + box.width / 2)) / 55;
    let dy = (clientY - (box.top + box.height / 2)) / 55;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    setStick({ x: dx, y: dy });
    stickVec.current = { x: dx, y: dy };
  }

  function endStick() {
    setStick({ x: 0, y: 0 });
    stickVec.current = { x: 0, y: 0 };
  }

  useEffect(() => {
    setMusicOn(musicPrefersOn());
  }, []);

  useEffect(() => {
    if (!playing || !musicOn) {
      stopStreetMusic();
      return;
    }
    startStreetMusic();
    return () => stopStreetMusic();
  }, [musicOn, playing]);

  useEffect(() => {
    duckStreetMusic(speaking || liveBusy);
  }, [liveBusy, speaking]);

  const fault = engineError || lastError?.message;
  const heard = listening ? interim : typed;
  const walking = look !== "idle";
  const blocked = !streaming && gpuBlocked(lastError?.message);
  const statusLabel = streaming
    ? "WORLD IS LIVE"
    : blocked
      ? "GPU BLOCKED — SEED STREET"
      : (STATUS_LINE[status] ?? status).toUpperCase();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-ink">
      <div className="street-world">
        <LingbotMainVideoView
          className="absolute inset-0 h-full w-full"
          videoObjectFit="cover"
        />
        {!streaming && (
          <div className="street-seed">
            <Image
              src={district.seedImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}
      </div>

      <div className="street-hud">
      <div className="gta-letter top" />
      <div className="gta-letter bot" />

      <p className="msgr-pixel pointer-events-none absolute top-3 right-20 z-20 text-[8px] text-white/80">
        {statusLabel}
      </p>
      {blocked && (
        <button
          type="button"
          className="gta-retry"
          onClick={() => {
            bustJwt();
            void reconnect();
          }}
        >
          RETRY LIVE GPU
        </button>
      )}

      <div className="gta-objective">
        <p className="msgr-pixel text-[8px]">{npc?.complete ? "DONE" : near ? "MISSION" : "DISTRICT"}</p>
        <p className={`mt-1 text-[15px] font-extrabold leading-snug ${npc?.complete ? "line-through opacity-50" : ""}`}>
          {npc?.complete ? scene.heritage.title : near ? step.goal : `Walk ${district.city}`}
        </p>
        <p className="gta-objective-sub">
          {blocked
            ? "GPU blocked. Retry, then hold W."
            : streaming
              ? near
                ? meta.label
                : "W walk · they speak · M places"
              : status === "waiting"
              ? "Hold W — GPU is coming, then you keep walking"
              : "Hold W — the street is opening"}
        </p>
      </div>

      <div className="gta-radar" aria-hidden>
        {district.encounters.map((item) => (
          <i
            key={item.key}
            className={`blip ${item.key === nearest.place.key && near ? "hot" : ""}`}
            style={{ left: radarPct(item.x), top: radarPct(10 - item.z) }}
            title={catalogOf(item.key).label}
          />
        ))}
        <i
          className="you"
          style={{
            left: radarPct(pos.x),
            top: radarPct(10 - pos.z),
            transform: `translate(-50%, -50%) rotate(${headingDeg(look)}deg)`,
          }}
        />
        <span className="place">{district.city.toUpperCase()}</span>
      </div>

      <nav className="msgr-sidebar" aria-label="World menu">
        <button type="button" className="msgr-side-btn" title="Menu" onClick={() => setPanel((p) => (p === "menu" ? null : "menu"))}>
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <button
          type="button"
          className={`msgr-side-btn ${musicOn ? "" : "off"}`}
          title={musicOn ? "Music on" : "Music off"}
          aria-pressed={musicOn}
          onClick={() => {
            setMusicOn((v) => {
              const next = !v;
              storeMusicPref(next);
              return next;
            });
          }}
        >
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 18V5l10-2v13" />
            <circle cx="6.5" cy="18" r="2.6" />
            <circle cx="16.5" cy="16" r="2.6" />
          </svg>
        </button>
        <button type="button" className="msgr-side-btn" title="Places" onClick={() => setPanel((p) => (p === "map" ? null : "map"))}>
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        </button>
        <button type="button" className="msgr-side-btn" title="Settings" onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}>
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth="2.4">
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
          </svg>
        </button>
      </nav>

      {!liveBusy && !near && (
        <p className="gta-walk-hint">
          {walking ? "Walking the district" : "Hold W — keep walking, the world stays with you"}
        </p>
      )}

      <div className="gta-sub">
        <div className="gta-sub-line">
          <div>
            <p className={`msgr-pixel text-[8px] ${speaking ? "is-talking" : ""}`}>{scene.speaker}</p>
            <p className={`${nativeFont} mt-1 text-[clamp(20px,2.4vw,28px)] leading-tight font-black`}>{lineNative}</p>
            {lineRoman ? <p className="gta-roman">{lineRoman}</p> : null}
            <p className="gta-en">{lineEn}</p>
          </div>
          {showType && (
            <form
              className="mt-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runJudge(typed);
              }}
            >
              <label htmlFor="line-input" className="sr-only">
                Type the line
              </label>
              <input
                id="line-input"
                ref={inputRef}
                value={listening ? heard || typed : typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={
                  listening
                    ? "Your turn — say the mission line"
                    : "Type the line if the street cannot hear you"
                }
                autoComplete="off"
                className="min-h-10 min-w-0 flex-1 rounded-md border-[3px] border-ink bg-paper px-3 text-sm text-ink"
              />
              <button type="submit" disabled={pending || !typed.trim()} className="msgr-btn px-3 py-2 text-[11px]">
                SAY IT
              </button>
            </form>
          )}
          <p className="gta-cue" aria-live="polite">
            {liveStarting
              ? `${place.speaker} is walking up…`
              : livePaused
                ? "Paused — tap play to keep talking"
                : speaking
                  ? `${scene.speaker} is speaking`
                  : listening
                    ? heard || `Your turn — say it in ${scene.language}.`
                    : pending
                      ? "The street is answering…"
                      : speechError ||
                        fault ||
                        (liveCall
                          ? "Walk to the next place. They stay on the street with you."
                          : `Walk up — ${place.speaker} speaks first.`)}
          </p>
        </div>
        {liveBusy ? (
          <div className="gta-talk-stack">
            <button
              type="button"
              className="gta-hang"
              aria-label="Leave this conversation"
              title="Hang up"
              onClick={leaveTalk}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
            {liveCall ? (
              <button
                type="button"
                className={`gta-pause ${livePaused ? "on" : ""}`}
                aria-pressed={livePaused}
                aria-label={livePaused ? "Resume talking" : "Pause talking"}
                title={livePaused ? "Resume (P)" : "Pause (P)"}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePause();
                }}
              >
                {livePaused ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                    <rect x="6" y="5" width="4" height="14" rx="0.5" />
                    <rect x="14" y="5" width="4" height="14" rx="0.5" />
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {npc?.complete && near && (
        <aside className="msgr-heritage">
          <p className="msgr-pixel text-[9px] text-[var(--accent-orange)]">HERITAGE</p>
          <h3 className="font-display mt-2 mb-1 text-[22px]">{scene.heritage.title}</h3>
          <p className={`${nativeFont} mb-2 text-base font-black text-primary`}>{scene.heritage.native}</p>
          <p className="mb-3.5 text-sm leading-[1.55] font-medium text-[#2a2a2a]">{scene.heritage.body}</p>
          <button type="button" onClick={replay} className="msgr-btn ghost px-3.5 py-2 text-xs">
            GOT IT
          </button>
        </aside>
      )}

      <div
        ref={stickRef}
        className="msgr-stick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          moveStick(e.clientX, e.clientY);
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
      >
        <i style={{ transform: `translate(${stick.x * 34}px, ${stick.y * 34}px)` }} />
      </div>
      <button
        type="button"
        className={`msgr-run ${look === "forward" ? "active" : ""}`}
        onPointerDown={() => {
          keys.current.w = true;
        }}
        onPointerUp={() => {
          keys.current.w = false;
        }}
        onPointerCancel={() => {
          keys.current.w = false;
        }}
      >
        RUN
      </button>

      {panel && (
        <div className="msgr-panel" onClick={() => setPanel(null)}>
          <div className="msgr-panel-card" onClick={(e) => e.stopPropagation()}>
            {panel === "menu" ? (
              <>
                <h2 className="font-display text-[26px]">WALK THE DISTRICT</h2>
                <p className="mb-4 text-[13px] font-bold text-[#555]">
                  Walk the street. They speak first. You answer in their language.
                </p>
                <div className="msgr-kv">
                  <span>Walk</span>
                  <kbd className="msgr-kbd">WASD</kbd>
                </div>
                <div className="msgr-kv">
                  <span>Places</span>
                  <kbd className="msgr-kbd">M</kbd>
                </div>
                <div className="msgr-kv">
                  <span>Hang up</span>
                  <kbd className="msgr-kbd">E</kbd>
                </div>
                <div className="msgr-kv">
                  <span>Pause</span>
                  <kbd className="msgr-kbd">P</kbd>
                </div>
                <div className="msgr-kv">
                  <span>Atlas</span>
                  <kbd className="msgr-kbd">ESC</kbd>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="msgr-btn ghost text-xs"
                    onClick={() => {
                      stopCall.current();
                      onBack();
                    }}
                  >
                    LEAVE DISTRICT
                  </button>
                </div>
              </>
            ) : panel === "map" ? (
              <>
                <h2 className="font-display text-[26px]">{district.city.toUpperCase()}</h2>
                <p className="mb-4 text-[13px] font-bold text-[#555]">
                  Fast2 places already crafted. Tap to walk there.
                </p>
                <ol className="world-places">
                  {district.encounters.map((item) => {
                    const card = catalogOf(item.key);
                    const here = item.key === placeKey && near;
                    return (
                      <li key={item.key}>
                        <button type="button" className={here ? "here" : ""} onClick={() => goTo(item)}>
                          <span className="who">{item.speaker}</span>
                          <span className="what">{card.label}</span>
                          <span className="why">{card.character}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <>
                <h2 className="font-display text-[26px]">SETTINGS</h2>
                <p className="mb-4 text-[13px] font-bold text-[#555]">{district.city} · {district.language}</p>
                <div className="msgr-kv">
                  <span>Type instead of speak</span>
                  <button
                    type="button"
                    className={`h-7 w-[52px] rounded-full border-[3px] border-ink ${showType ? "bg-gold" : "bg-[#e6e4da]"}`}
                    aria-pressed={showType}
                    onClick={() => {
                      setShowType((v) => !v);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  >
                    <i className={`block h-5 w-5 rounded-full bg-ink transition-[margin] ${showType ? "ml-[22px]" : "ml-px"}`} />
                  </button>
                </div>
              </>
            )}
            <div className="mt-5 flex justify-end">
              <button type="button" className="msgr-btn ghost text-xs" onClick={() => setPanel(null)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {pending
          ? "The world is listening"
          : listening
            ? heard || "Listening"
            : speechError || fault || ""}
      </p>
      </div>
    </main>
  );
}
