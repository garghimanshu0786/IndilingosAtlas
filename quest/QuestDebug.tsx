"use client";

import { useEffect, useState, type RefObject } from "react";
import { onWorldLog } from "@/lib/worldLog";
import { xrPadAxes } from "./xrInput";

export function QuestDebug({
  status,
  sessionId,
  live,
  streaming,
  hasTrack,
  inVr,
  secure,
  lastError,
  engineError,
  moveRef,
  lookHRef,
  lookVRef,
  rootRef,
}: {
  status: string;
  sessionId?: string;
  live: boolean;
  streaming: boolean;
  hasTrack: boolean;
  inVr: boolean;
  secure: boolean;
  lastError?: string;
  engineError?: string | null;
  moveRef: RefObject<string>;
  lookHRef: RefObject<string>;
  lookVRef: RefObject<string>;
  rootRef: RefObject<HTMLElement | null>;
}) {
  const [rows, setRows] = useState<{ id: number; t: number; msg: string }[]>([]);
  const [open, setOpen] = useState(true);
  const [video, setVideo] = useState("—");
  const [drive, setDrive] = useState("move=idle look=idle/idle");
  const [padHint, setPadHint] = useState("0,0");

  useEffect(() => onWorldLog(setRows), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDrive(`move=${moveRef.current} look=${lookHRef.current}/${lookVRef.current}`);
      if (inVr) {
        const p = xrPadAxes();
        setPadHint(`${p.x.toFixed(2)},${p.y.toFixed(2)}`);
      }
      const el = rootRef.current?.querySelector("video");
      if (!el) {
        setVideo("no video element");
        return;
      }
      setVideo(
        `${el.videoWidth || 0}×${el.videoHeight || 0} rs${el.readyState} ${el.paused ? "paused" : "play"} t${Math.round(el.currentTime)}s`,
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [inVr, lookHRef, lookVRef, moveRef, rootRef]);

  return (
    <aside className={`quest-debug ${open ? "open" : ""}`} aria-label="Quest debug">
      <button type="button" className="quest-debug-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "DEBUG ▾" : "DEBUG ▸"}
      </button>
      {open ? (
        <div className="quest-debug-body">
          <p>
            <strong>visual</strong> stream={streaming ? "LIVE" : "seed"} track={hasTrack ? "yes" : "no"} live=
            {live ? "yes" : "no"}
          </p>
          <p>
            <strong>lingbot</strong> {status}
            {sessionId ? ` · ${sessionId.slice(0, 8)}` : ""}
          </p>
          <p>
            <strong>video</strong> {video}
          </p>
          <p>
            <strong>drive</strong> {drive} vr={inVr ? "yes" : "no"} https={secure ? "yes" : "no"}
            {inVr ? ` pad=${padHint}` : ""}
          </p>
          {(lastError || engineError) && (
            <p className="quest-debug-err">
              <strong>err</strong> {engineError || lastError}
            </p>
          )}
          <ol>
            {rows.slice(-10).map((row) => (
              <li key={row.id}>
                <span>{new Date(row.t).toLocaleTimeString()}</span>
                {row.msg}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </aside>
  );
}
