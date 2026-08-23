"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechEngine = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{
      isFinal: boolean;
      0: { transcript: string };
    }>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getEngine(): (new () => SpeechEngine) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechEngine;
    webkitSpeechRecognition?: new () => SpeechEngine;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return getEngine() !== null;
}

export function useSpeech(lang: string, onUtterance: (text: string) => void) {
  const recRef = useRef<SpeechEngine | null>(null);
  const transcriptRef = useRef("");
  const wantRef = useRef(false);
  const restartRef = useRef<number | null>(null);
  const silenceRef = useRef<number | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const available = speechSupported();

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const clearTimers = useCallback(() => {
    if (restartRef.current !== null) window.clearTimeout(restartRef.current);
    if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
    restartRef.current = null;
    silenceRef.current = null;
  }, []);

  const flush = useCallback(() => {
    const spoken = transcriptRef.current.trim();
    transcriptRef.current = "";
    setInterim("");
    if (spoken) onUtteranceRef.current(spoken);
  }, []);

  const arm = useCallback((rec: SpeechEngine) => {
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let finals = "";
      let live = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += `${piece} `;
        else live += piece;
      }
      const spoken = (finals + live).trim();
      transcriptRef.current = spoken;
      setInterim(spoken);
      if (!spoken) return;
      if (silenceRef.current !== null) window.clearTimeout(silenceRef.current);
      silenceRef.current = window.setTimeout(() => {
        if (!wantRef.current || !transcriptRef.current.trim()) return;
        wantRef.current = false;
        recRef.current?.stop();
      }, 1400);
    };
    rec.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      wantRef.current = false;
      setListening(false);
      setError(
        event.error === "not-allowed"
          ? "Mic permission is blocked."
          : "Could not hear that. Hold gold and speak, or type.",
      );
    };
    rec.onend = () => {
      if (wantRef.current) {
        restartRef.current = window.setTimeout(() => {
          if (!wantRef.current) return;
          try {
            rec.start();
            setListening(true);
          } catch {
            restartRef.current = window.setTimeout(() => {
              if (!wantRef.current) return;
              try {
                rec.start();
                setListening(true);
              } catch {
                setListening(false);
              }
            }, 400);
          }
        }, 250);
        return;
      }
      setListening(false);
      flush();
    };
  }, [flush, lang]);

  useEffect(() => {
    const Ctor = getEngine();
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    arm(rec);
    return () => {
      wantRef.current = false;
      clearTimers();
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort();
      recRef.current = null;
    };
  }, [arm, clearTimers]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) {
      setError("This browser has no speech recognition. Type instead.");
      return;
    }
    clearTimers();
    setError(null);
    setInterim("");
    transcriptRef.current = "";
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      restartRef.current = window.setTimeout(() => {
        if (!wantRef.current) return;
        try {
          rec.start();
          setListening(true);
        } catch {
          setListening(false);
        }
      }, 300);
    }
  }, [clearTimers]);

  const stop = useCallback(() => {
    wantRef.current = false;
    clearTimers();
    recRef.current?.stop();
  }, [clearTimers]);

  const toggle = useCallback(() => {
    if (wantRef.current || listening) stop();
    else start();
  }, [listening, start, stop]);

  return { available, listening, interim, error, start, stop, toggle };
}

export function unlockPlayback() {
  if (typeof window === "undefined") return;
  const silent = new Audio(
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
  );
  silent.volume = 0.01;
  void silent.play().catch(() => {});
}

export function speakLine(locale: string, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale;
  utter.rate = 0.95;
  const prefix = locale.slice(0, 2).toLowerCase();
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    voices.find((v) => v.lang.toLowerCase().includes(prefix)) ??
    (prefix === "hi"
      ? voices.find((v) => /hindi|lekha|india/i.test(`${v.name} ${v.lang}`))
      : undefined);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}
