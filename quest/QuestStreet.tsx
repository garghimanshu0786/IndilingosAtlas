"use client";

import {
  LingbotMainVideoView,
  LingbotProvider,
  useLingbot,
  useLingbotCommandError,
  useLingbotGenerationStarted,
  useLingbotImageAccepted,
  useLingbotTrack,
} from "@reactor-models/lingbot";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asScene, lingbotPrompt, nearestEncounter, type District, type Encounter } from "@/lib/district";
import { killStreetLive, useStreetLive } from "@/lib/streetLive";
import { getJwt } from "@/lib/streetSession";
import { startLingbotStreet } from "@/lib/startStreet";
import { worldLog } from "@/lib/worldLog";
import { canEnterVr, enterCinema, findStreetVideo } from "./cinema";
import { QuestDebug } from "./QuestDebug";
import { readQuestAxes, useQuestDrive, type LookH, type LookV } from "./useQuestDrive";

const RANGE_IN = 1.2;
const RANGE_OUT = 1.9;

export function QuestStreet({ district, onLeave }: { district: District; onLeave: () => void }) {
  return (
    <LingbotProvider getJwt={getJwt} connectOptions={{ autoConnect: true }}>
      <Street district={district} onLeave={onLeave} />
    </LingbotProvider>
  );
}

function Street({ district, onLeave }: { district: District; onLeave: () => void }) {
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
  } = useLingbot();
  const videoTrack = useLingbotTrack("main_video");
  const first = district.encounters[0];
  const placeRef = useRef(first);
  const [pos, setPos] = useState({ x: 5.5, z: 6 });
  const [placeKey, setPlaceKey] = useState(first.key);
  const [live, setLive] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const headLook = useRef<{ h: LookH; v: LookV }>({ h: "idle", v: "idle" });
  const [line, setLine] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [vrHint, setVrHint] = useState<string | null>(null);
  const [inVr, setInVr] = useState(false);
  const [vrOk, setVrOk] = useState(false);
  const [secure, setSecure] = useState(true);
  const startedFor = useRef<string | null>(null);
  const startArmed = useRef(false);
  const imageWait = useRef<(() => void) | null>(null);
  const joined = useRef(false);
  const lastPrompt = useRef<string | null>(null);
  const promptPulse = useRef(0);
  const arriveNext = useRef(false);
  const nearRef = useRef(false);
  const liveRef = useRef(false);
  const districtRef = useRef(district);
  districtRef.current = district;
  const rootRef = useRef<HTMLElement>(null);
  const stickBox = useRef<HTMLDivElement>(null);
  const leaveVr = useRef<(() => void) | null>(null);
  const cmd = useRef({ setPrompt, setImage, setMovement, setLookHorizontal, setLookVertical, start, uploadFile });
  cmd.current = { setPrompt, setImage, setMovement, setLookHorizontal, setLookVertical, start, uploadFile };

  const nearest = nearestEncounter(district, pos);
  const near = nearest.range < (placeKey === nearest.place.key ? RANGE_OUT : RANGE_IN);
  const place = district.encounters.find((item) => item.key === placeKey) ?? nearest.place;
  placeRef.current = place;
  nearRef.current = near;
  liveRef.current = live;
  const scene = useMemo(() => asScene(district, place), [district, place]);

  const { available, active, connecting, listening, paused, error, start: startCall, stop, togglePause, cuePlace } =
    useStreetLive(scene, {
      onUserText: () => undefined,
      onModelText: (text) => setLine(text),
      onSpeaking: () => undefined,
    });

  useLingbotImageAccepted(() => {
    worldLog("quest image accepted");
    imageWait.current?.();
    imageWait.current = null;
  });
  useLingbotGenerationStarted(() => {
    worldLog("quest generation started");
    setLive(true);
  });

  useLingbotCommandError((err) => {
    worldLog("quest command error", err.command, err.reason);
    setEngineError("The world missed that cue. Try the stick again.");
  });

  useEffect(() => {
    setSecure(window.isSecureContext);
    void canEnterVr().then(setVrOk);
  }, []);

  useEffect(() => {
    worldLog(
      "quest status",
      status,
      sessionId ? sessionId.slice(0, 8) : "no-session",
      videoTrack ? "track" : "no-track",
      live ? "live" : "not-live",
      lastError?.message ?? "ok",
    );
  }, [lastError?.message, live, sessionId, status, videoTrack]);

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
        worldLog("quest start failed", err);
        if (!cancelled) {
          startedFor.current = null;
          setEngineError(err instanceof Error ? err.message : "Could not open this street.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (!startArmed.current && startedFor.current === sessionId) startedFor.current = null;
    };
  }, [district.id, sessionId, status]);

  const drive = useQuestDrive(
    {
      setMovement,
      setLookHorizontal,
      setLookVertical,
      ready: () => status === "ready",
    },
    stick,
    headLook,
    {
      setPrompt,
      isLive: () => liveRef.current,
      isNear: () => nearRef.current,
      district,
      getPlace: () => placeRef.current,
      promptPulse,
      lastPrompt,
    },
    sessionId ?? null,
  );
  const { lastMove, lastLookH, lastLookV, resetDrive } = drive;

  useEffect(() => {
    if (status !== "ready" || !live) return;
    const arriving = arriveNext.current;
    arriveNext.current = false;
    const walking = lastMove.current !== "idle";
    const next = lingbotPrompt(district, place, !walking && near, false, promptPulse.current, arriving && !walking);
    if (lastPrompt.current === next) return;
    lastPrompt.current = next;
    void setPrompt({ prompt: next });
  }, [district, lastMove, live, near, place, setPrompt, status]);

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
  }, [district, lastMove, live, near, place, setPrompt, status]);

  const stickRef = useRef(stick);
  stickRef.current = stick;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pad = readQuestAxes();
      const x = Math.abs(pad.x) > 0.2 ? pad.x : stickRef.current.x;
      const y = Math.abs(pad.y) > 0.2 ? pad.y : stickRef.current.y;
      if (x || y) {
        const n = Math.hypot(x, y) || 1;
        setPos((p) => ({
          x: Math.min(9.6, Math.max(0.4, p.x + (x / n) * 3.6 * dt)),
          z: Math.min(9.6, Math.max(0.4, p.z + (-y / n) * 3.6 * dt)),
        }));
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const greeted = useRef<string | null>(null);
  const enterPlace = useCallback((next: Encounter) => {
    if (next.key !== placeKey) {
      arriveNext.current = true;
      promptPulse.current += 1;
    }
    setPlaceKey(next.key);
    return asScene(district, next);
  }, [district, placeKey]);

  useEffect(() => {
    if (!near) {
      greeted.current = null;
      return;
    }
    if (greeted.current === nearest.place.key) return;
    greeted.current = nearest.place.key;
    const next = enterPlace(nearest.place);
    if (active) cuePlace(next);
  }, [active, cuePlace, enterPlace, near, nearest.place]);

  useEffect(() => {
    if (!available || joined.current) return;
    joined.current = true;
    void startCall();
  }, [available, startCall]);

  const streaming = Boolean(videoTrack) && live;

  useEffect(() => {
    worldLog("quest stream", streaming ? "WORLD IS LIVE" : "seed overlay", `live=${live}`, `track=${Boolean(videoTrack)}`);
  }, [live, streaming, videoTrack]);

  const nativeFont = scene.font === "jp" ? "font-jp" : "font-deva";

  const goVr = useCallback(async () => {
    const video = rootRef.current ? findStreetVideo(rootRef.current) : document.querySelector("video");
    if (!video || video.videoWidth < 1) {
      setVrHint("Wait until WORLD IS LIVE, then Enter VR.");
      return;
    }
    try {
      setVrHint(null);
      worldLog("quest enter VR");
      resetDrive();
      leaveVr.current = await enterCinema(
        video,
        (look) => {
          headLook.current = look;
        },
        rootRef.current,
        () => setInVr(false),
      );
      setInVr(true);
    } catch (err) {
      worldLog("quest VR failed", err);
      setVrHint(err instanceof Error ? err.message : "Enter VR failed. Stay on the panel — the street is still live.");
    }
  }, [resetDrive]);

  function leave() {
    leaveVr.current?.();
    leaveVr.current = null;
    setInVr(false);
    headLook.current = { h: "idle", v: "idle" };
    if (status === "ready") {
      void setMovement({ movement: "idle" });
      void setLookHorizontal({ look_horizontal: "idle" });
      void setLookVertical({ look_vertical: "idle" });
    }
    stop();
    killStreetLive();
    onLeave();
  }

  function moveStick(clientX: number, clientY: number) {
    const el = stickBox.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    let dx = (clientX - (box.left + box.width / 2)) / 70;
    let dy = (clientY - (box.top + box.height / 2)) / 70;
    const mag = Math.hypot(dx, dy) || 1;
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    setStick({ x: dx, y: dy });
  }

  const cue =
    connecting
      ? `${place.speaker} is walking up…`
      : paused
        ? "Paused"
        : listening
          ? `Your turn — ${scene.language}`
          : error || engineError || lastError?.message || vrHint
            || (inVr
              ? "Left stick walks the street · head / right stick looks"
              : streaming
                ? "Drag the stick to walk here · ENTER VR for controller + head"
                : "Wait for WORLD IS LIVE, then walk");

  return (
    <main ref={rootRef} className={`quest-street${inVr ? " is-vr" : ""}`}>
      <LingbotMainVideoView className="quest-video" videoObjectFit="cover" />
      {!streaming && (
        <div className="quest-seed">
          <Image src={district.seedImage} alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
      )}

      <p className="quest-status">{streaming ? "WORLD IS LIVE" : (status === "waiting" ? "GPU…" : "OPENING")}</p>
      <p className="quest-city">{district.city.toUpperCase()}</p>

      <div className="quest-sub">
        <p className="quest-who">{scene.speaker}</p>
        <p className={`${nativeFont} quest-line`}>{line ?? scene.opening.native}</p>
        <p className="quest-cue">{cue}</p>
      </div>

      <div className="quest-actions">
        {vrOk && (
          <button type="button" className="quest-btn" disabled={inVr || !streaming} onClick={() => void goVr()}>
            {inVr ? "WALKING" : "ENTER VR"}
          </button>
        )}
        {active && (
          <button type="button" className="quest-btn ghost" onClick={togglePause}>
            {paused ? "PLAY" : "PAUSE"}
          </button>
        )}
        {active && (
          <button type="button" className="quest-btn ghost" onClick={stop} aria-label="Hang up">
            ×
          </button>
        )}
        <button type="button" className="quest-btn ghost" onClick={leave}>
          BACK
        </button>
      </div>

      <div
        ref={stickBox}
        className={`quest-stick${streaming ? " live" : ""}`}
        aria-label="Walk stick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          moveStick(e.clientX, e.clientY);
        }}
        onPointerUp={() => setStick({ x: 0, y: 0 })}
        onPointerCancel={() => setStick({ x: 0, y: 0 })}
      >
        <i style={{ transform: `translate(${stick.x * 36}px, ${stick.y * 36}px)` }} />
      </div>

      <QuestDebug
        status={status}
        sessionId={sessionId}
        live={live}
        streaming={streaming}
        hasTrack={Boolean(videoTrack)}
        inVr={inVr}
        secure={secure}
        lastError={lastError?.message}
        engineError={engineError}
        moveRef={lastMove}
        lookHRef={lastLookH}
        lookVRef={lastLookV}
        rootRef={rootRef}
      />
    </main>
  );
}
