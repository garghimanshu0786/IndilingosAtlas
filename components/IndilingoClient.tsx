"use client";

import nextDynamic from "next/dynamic";
import { useState } from "react";
import { getDistrict } from "@/lib/district";
import { killStreetLive } from "@/lib/streetLive";
import { WorldHome, WorldTitle } from "./WorldHome";

const Live = nextDynamic(
  () => import("./Indilingo").then((mod) => mod.Indilingo),
  { ssr: false, loading: () => null },
);

export function IndilingoClient() {
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const district = getDistrict(districtId);

  if (!district) {
    return (
      <WorldHome
        onEnter={(id) => {
          setDistrictId(id);
          setPlaying(false);
        }}
      />
    );
  }

  const leave = () => {
    killStreetLive();
    setPlaying(false);
    setDistrictId(null);
  };

  return (
    <>
      <Live district={district} playing={playing} onBack={leave} />
      {!playing ? (
        <WorldTitle districtId={district.id} onBegin={() => setPlaying(true)} onBack={leave} />
      ) : null}
    </>
  );
}
