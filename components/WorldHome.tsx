"use client";

import { useEffect, useState } from "react";
import { CITIES, cityById, cityIsLive, liveDistrictId, type City } from "@/lib/atlas";
import { readStoredFocus, storeFocus } from "@/lib/session";
import { primeStreetAudio } from "@/lib/liveAudio";
import { warmStreet } from "@/lib/warmStreet";
import { Earth } from "./Earth";

type Screen = "loading" | "map";

export function WorldTitle({
  districtId,
  onBegin,
  onBack,
}: {
  districtId: string;
  onBegin: () => void;
  onBack: () => void;
}) {
  const city = cityById(districtId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <main className="atlas-title over-street">
      <p className="font-display msgr-wordmark">INDILINGO</p>
      <p className="atlas-tagline">
        {city?.native} · {city?.blurb}
      </p>
      <div className="atlas-begin">
        <div className="atlas-begin-row">
          <button
            type="button"
            className="msgr-btn msgr-begin"
            onClick={() => {
              onBegin();
              void primeStreetAudio();
            }}
          >
            BEGIN
          </button>
          <button type="button" className="msgr-btn ghost" onClick={onBack}>
            BACK
          </button>
        </div>
        <p>hold W — the street is already opening</p>
      </div>
    </main>
  );
}

export function WorldHome({ onEnter }: { onEnter: (districtId: string) => void }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [fill, setFill] = useState(0);
  const [focus, setFocus] = useState<City>(CITIES[0]);
  const [card, setCard] = useState(false);

  const live = cityIsLive(focus.id);
  const districtId = liveDistrictId(focus.id);

  useEffect(() => {
    const stored = readStoredFocus();
    const next = CITIES.find((place) => place.id === stored);
    if (next) setFocus(next);
  }, []);

  useEffect(() => {
    storeFocus(focus.id);
  }, [focus.id]);

  useEffect(() => {
    warmStreet("delhi");
    warmStreet("tokyo");
    void import("./Indilingo");
  }, []);

  useEffect(() => {
    if (screen !== "loading") return;
    const tick = window.setInterval(() => {
      setFill((n) => {
        const next = Math.min(100, n + 8 + Math.random() * 14);
        if (next >= 100) {
          window.clearInterval(tick);
          window.setTimeout(() => setScreen("map"), 280);
        }
        return next;
      });
    }, 90);
    return () => window.clearInterval(tick);
  }, [screen]);

  function pick(place: City) {
    setFocus(place);
    setCard(true);
  }

  function enterCity() {
    if (!districtId) return;
    warmStreet(districtId);
    onEnter(districtId);
  }

  if (screen === "loading") {
    return (
      <main className="atlas-load">
        <svg viewBox="0 0 120 84" aria-hidden>
          <rect x="6" y="12" width="108" height="66" rx="7" className="envelope-line" />
          <path d="M8 16 L60 52 L112 16" className="envelope-line" />
        </svg>
        <p className="msgr-script load-dots atlas-load-word">LOADING</p>
        <div className="atlas-load-bar">
          <i style={{ width: `${fill}%` }} />
        </div>
      </main>
    );
  }

  return (
    <main className="atlas">
      <header className="atlas-head">
        <p className="atlas-kicker">INDILINGO&apos;S ATLAS</p>
        <h1 className="font-display stroke-title">CHOOSE A DESTINATION</h1>
        <p className="atlas-sub">learn the language · culture · heritage of each little world</p>
      </header>

      <section className="atlas-globe">
        <Earth cities={CITIES} focus={focus} locked={card} onPick={pick} />

        <div className={`dest-card ${card ? "show" : ""}`}>
          <div className="name">
            {focus.name.toUpperCase()}
            <span className="native">{focus.native}</span>
          </div>
          <p>
            {live
              ? focus.blurb
              : `Indilingo hasn’t packed a bag for ${focus.name} yet — this world is coming soon. For now, board for Delhi or Tokyo.`}
          </p>
          <div className="row">
            <button
              type="button"
              className={`msgr-btn ${live ? "" : "disabled"}`}
              disabled={!live}
              onClick={enterCity}
            >
              {live ? "ENTER" : "COMING SOON"}
            </button>
            <button type="button" className="msgr-btn ghost" onClick={() => setCard(false)}>
              BACK
            </button>
          </div>
        </div>
      </section>

      <p className="atlas-hint">drag to spin the globe · tap a marker to visit</p>
    </main>
  );
}
