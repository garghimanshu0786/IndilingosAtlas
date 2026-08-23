"use client";

import { useEffect, useState } from "react";
import { getDistrict } from "@/lib/district";
import { killStreetLive } from "@/lib/streetLive";
import { primeStreetAudio } from "@/lib/liveAudio";
import { warmStreet } from "@/lib/warmStreet";
import { QuestStreet } from "./QuestStreet";
import { canEnterVr } from "./cinema";
import "./quest.css";

export function QuestClient() {
  const [city, setCity] = useState<string | null>(null);
  const [secure, setSecure] = useState(true);
  const [xr, setXr] = useState(false);
  const [wifiUrl, setWifiUrl] = useState<string | null>(null);
  const district = getDistrict(city);

  useEffect(() => {
    setSecure(window.isSecureContext);
    void canEnterVr().then(setXr);
    warmStreet("delhi");
    warmStreet("tokyo");
    void fetch("/api/quest/hint")
      .then((r) => r.json())
      .then((body: { quest?: string }) => setWifiUrl(body.quest ?? null))
      .catch(() => undefined);
  }, []);

  if (district) {
    return (
      <QuestStreet
        district={district}
        onLeave={() => {
          killStreetLive();
          setCity(null);
        }}
      />
    );
  }

  return (
    <main className="quest-pick">
      <p className="quest-mark">INDILINGO</p>
      <p className="quest-tag">Live street on Quest 3S · Delhi or Tokyo</p>
      {!secure && (
        <p className="quest-warn">
          This tab is not HTTPS. Mic and Enter VR will be blocked. On the Mac run
          <code> npx next dev --experimental-https -H 0.0.0.0 </code>
          then open the HTTPS URL below in Quest Browser.
        </p>
      )}
      {wifiUrl && (
        <p className="quest-foot">
          Wi‑Fi: open <strong>{wifiUrl.replace(/^http:/, "https:")}</strong> in Quest Browser (same Wi‑Fi as this Mac).
          {" "}Or USB: <code>sh quest/wire.sh</code>
        </p>
      )}
      <div className="quest-cities">
        <button
          type="button"
          className="quest-city-btn"
          onClick={() => {
            void primeStreetAudio();
            warmStreet("delhi");
            setCity("delhi");
          }}
        >
          <span>DELHI</span>
          <small>हिंदी · walk and talk</small>
        </button>
        <button
          type="button"
          className="quest-city-btn"
          onClick={() => {
            void primeStreetAudio();
            warmStreet("tokyo");
            setCity("tokyo");
          }}
        >
          <span>TOKYO</span>
          <small>日本語 · walk and talk</small>
        </button>
      </div>
      <p className="quest-foot">
        {xr ? "ENTER VR after the street is live." : "Quest Browser panel — the street is still live video."}
        {" "}Thumbstick or the on-screen stick walks. One language per city.
      </p>
    </main>
  );
}
