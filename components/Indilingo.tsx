"use client";

import { LingbotProvider } from "@reactor-models/lingbot";
import type { District } from "@/lib/district";
import { getJwt } from "@/lib/streetSession";
import { Stage } from "./Stage";

export function Indilingo({
  district,
  playing = true,
  onBack,
}: {
  district: District;
  playing?: boolean;
  onBack: () => void;
}) {
  return (
    <LingbotProvider getJwt={getJwt} connectOptions={{ autoConnect: true }}>
      <Stage district={district} playing={playing} onBack={onBack} />
    </LingbotProvider>
  );
}
