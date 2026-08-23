export function Lighting() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-white">
      <svg viewBox="0 0 120 84" className="h-auto w-[120px]" aria-hidden>
        <rect x="6" y="12" width="108" height="66" rx="7" fill="none" stroke="#141414" strokeWidth="5" />
        <path d="M8 16 L60 52 L112 16" fill="none" stroke="#141414" strokeWidth="5" />
      </svg>
      <p className="msgr-script load-dots text-[40px] tracking-[2px] text-ink">LOADING</p>
    </main>
  );
}

export function Setup() {
  return (
    <main className="relative flex min-h-dvh items-end overflow-hidden bg-night">
      <section className="msgr-card relative z-10 m-6 w-full max-w-xl p-7">
        <p className="font-display stroke-title text-4xl">INDILINGO</p>
        <h1 className="font-display mt-6 text-4xl leading-none">Atlas needs the API.</h1>
        <p className="mt-4 text-base leading-7 font-medium text-[#333]">
          Set <code className="font-bold">INDILINGO_API_URL</code> to your Indilingo server and optional{" "}
          <code className="font-bold">INDILINGO_API_KEY</code>, then restart.
        </p>
      </section>
    </main>
  );
}
