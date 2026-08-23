"use client";

import nextDynamic from "next/dynamic";

const Quest = nextDynamic(() => import("@/quest/QuestClient").then((mod) => mod.QuestClient), {
  ssr: false,
  loading: () => (
    <main className="grid min-h-dvh place-items-center bg-[#7ed0c0] font-black text-[#141414]">
      Opening the Quest street…
    </main>
  ),
});

export default function QuestPage() {
  return <Quest />;
}
