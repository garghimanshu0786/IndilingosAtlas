"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streetCapContext, streetPlayContext } from "./liveAudio";
import { liveResume, liveWalked, liveWalkUp } from "./livePrompt";
import type { Scene } from "./scenes";
import { worldLog } from "./worldLog";

const IN_RATE = 16_000;
const OUT_RATE = 24_000;
const CHUNK_MS = 25;
const CHUNK_SAMPLES = (IN_RATE * CHUNK_MS) / 1000;
const PREBUFFER = 1;
const MIN_PLAY_BYTES = 100;

type LiveHandlers = {
  onUserText: (text: string) => void;
  onModelText: (text: string) => void;
  onSpeaking: (on: boolean) => void;
};

type ServerMsg = {
  setupComplete?: object;
  error?: { message?: string; code?: number };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
  };
};

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.round(input.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = x - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatTo16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

class PcmPlayer {
  private ctx: AudioContext | null = null;
  private next = 0;
  private queue: ArrayBuffer[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private primed = false;
  muted = false;
  gen = 0;

  ensure() {
    this.ctx = streetPlayContext() ?? this.ctx ?? new AudioContext({ sampleRate: OUT_RATE });
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(pcm: ArrayBuffer) {
    if (this.muted || pcm.byteLength < MIN_PLAY_BYTES) return;
    this.queue.push(pcm);
    if (!this.primed && this.queue.length < PREBUFFER) return;
    this.kick();
  }

  bump() {
    this.gen += 1;
    this.clear();
  }

  kick() {
    if (!this.queue.length) return;
    this.primed = true;
    this.flush();
  }

  private flush() {
    const ctx = this.ensure();
    while (this.queue.length) {
      const pcm = this.queue.shift();
      if (!pcm) break;
      const view = new Int16Array(pcm);
      const f32 = new Float32Array(view.length);
      for (let i = 0; i < view.length; i += 1) f32[i] = view[i] / 32768;
      const buf = ctx.createBuffer(1, f32.length, OUT_RATE);
      buf.copyToChannel(f32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const start = Math.max(ctx.currentTime, this.next);
      src.start(start);
      this.next = start + buf.duration;
      this.sources.push(src);
      src.onended = () => {
        this.sources = this.sources.filter((node) => node !== src);
      };
    }
  }

  clear() {
    this.queue = [];
    this.primed = false;
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        
      }
    }
    this.sources = [];
    if (this.ctx) this.next = this.ctx.currentTime;
  }
}

const boot = {
  starting: false,
  active: false,
  gen: 0,
  district: null as string | null,
  ws: null as WebSocket | null,
  stream: null as MediaStream | null,
  player: new PcmPlayer(),
};

function districtKey(scene: Scene) {
  return scene.id.split(":")[0] || scene.city;
}

export function killStreetLive() {
  boot.gen += 1;
  boot.starting = false;
  boot.active = false;
  boot.district = null;
  const ws = boot.ws;
  boot.ws = null;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.onclose = null;
    ws.close();
  }
  boot.stream?.getTracks().forEach((track) => track.stop());
  boot.stream = null;
  boot.player.muted = false;
  boot.player.bump();
}

function liveCloseError(code: number, reason: string) {
  const text = reason.trim();
  if (/quota|billing|exceeded/i.test(text)) {
    return "Live speech quota is used up on the Indilingo API.";
  }
  if (text) return text.length > 180 ? `${text.slice(0, 177)}…` : text;
  return `Live speech closed (${code || "no code"}).`;
}

function readWsText(event: MessageEvent): Promise<string | null> {
  if (typeof event.data === "string") return Promise.resolve(event.data);
  if (event.data instanceof Blob) {
    return event.data.text().then((text) => (text.startsWith("{") ? text : null));
  }
  if (event.data instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(event.data);
    return Promise.resolve(text.startsWith("{") ? text : null);
  }
  return Promise.resolve(null);
}

export function useStreetLive(scene: Scene, handlers: LiveHandlers) {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef(boot.player);
  const userBuf = useRef("");
  const modelBuf = useRef("");
  const activeRef = useRef(false);
  const setupDone = useRef(false);
  const starting = useRef(false);
  const pcmCarry = useRef(new Float32Array(0));
  const pcmSent = useRef(0);
  const pausedRef = useRef(false);
  const liveGen = useRef(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    if (ctxRef.current && ctxRef.current !== streetCapContext()) {
      void ctxRef.current.close();
    }
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pcmCarry.current = new Float32Array(0);
    pcmSent.current = 0;
  }, []);

  const tearDown = useCallback(() => {
    starting.current = false;
    activeRef.current = false;
    setupDone.current = false;
    pausedRef.current = false;
    wsRef.current = null;
    killStreetLive();
    stopMic();
    setConnecting(false);
    setActive(false);
    setListening(false);
    setSpeaking(false);
    setPaused(false);
    setInterim("");
  }, [stopMic]);

  const startMic = useCallback(async (ws: WebSocket, stream: MediaStream) => {
    const shared = streetCapContext();
    const ctx =
      ctxRef.current && ctxRef.current.state !== "closed"
        ? ctxRef.current
        : shared && shared.state !== "closed"
          ? shared
          : new AudioContext();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (event) => {
      if (!setupDone.current || pausedRef.current || ws.readyState !== WebSocket.OPEN) return;
      const input = downsample(event.inputBuffer.getChannelData(0), ctx.sampleRate, IN_RATE);
      const merged = new Float32Array(pcmCarry.current.length + input.length);
      merged.set(pcmCarry.current);
      merged.set(input, pcmCarry.current.length);
      let offset = 0;
      while (offset + CHUNK_SAMPLES <= merged.length) {
        const slice = merged.subarray(offset, offset + CHUNK_SAMPLES);
        const pcm = floatTo16(slice);
        ws.send(
          JSON.stringify({
            realtimeInput: {
              audio: { mimeType: "audio/pcm;rate=16000", data: bytesToB64(pcm) },
            },
          }),
        );
        pcmSent.current += 1;
        if (pcmSent.current === 1 || pcmSent.current === 40) {
          worldLog("live pcm", pcmSent.current, "ctx", ctx.state);
        }
        offset += CHUNK_SAMPLES;
      }
      pcmCarry.current = merged.slice(offset);
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
  }, []);

  const handleMessage = useCallback((raw: string) => {
      if (liveGen.current !== boot.gen) return;
      let msg: ServerMsg;
      try {
        msg = JSON.parse(raw) as ServerMsg;
      } catch {
        return;
      }

      if (msg.error?.message) {
        worldLog("live error", msg.error.message);
        setError(msg.error.message);
        return;
      }

      const sc = msg.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        playerRef.current.clear();
        setSpeaking(false);
        handlersRef.current.onSpeaking(false);
        return;
      }

      const heard = sc.inputTranscription?.text;
      if (heard) {
        userBuf.current += heard;
        setInterim(userBuf.current);
        worldLog("live heard", heard);
      }

      const spoken = sc.outputTranscription?.text;
      if (spoken) {
        modelBuf.current += spoken;
        handlersRef.current.onModelText(modelBuf.current.trim());
      }

      for (const part of sc.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (!data || !part.inlineData?.mimeType?.includes("audio")) continue;
        if (pausedRef.current) continue;
        setSpeaking(true);
        handlersRef.current.onSpeaking(true);
        playerRef.current.ensure();
        playerRef.current.play(b64ToBytes(data));
      }

      if (sc.turnComplete) {
        const user = userBuf.current.trim();
        const model = modelBuf.current.trim();
        userBuf.current = "";
        modelBuf.current = "";
        setInterim("");
        setSpeaking(false);
        handlersRef.current.onSpeaking(false);
        playerRef.current.kick();
        worldLog("live turn", user ? `user:${user}` : "user:none", model ? "model:yes" : "model:none");
        if (user) handlersRef.current.onUserText(user);
        if (model) handlersRef.current.onModelText(model);
        setListening(true);
      }
    },
    [],
  );

  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const sendRealtime = useCallback((text: string) => {
    const ws = wsRef.current ?? boot.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || !setupDone.current) return false;
    playerRef.current.clear();
    ws.send(JSON.stringify({ realtimeInput: { text } }));
    return true;
  }, []);

  const speakFirst = useCallback(
    (next?: Scene) => {
      const here = next ?? sceneRef.current;
      if (next) sceneRef.current = next;
      if (sendRealtime(liveWalkUp(here))) worldLog("live kick", here.speaker);
    },
    [sendRealtime],
  );

  const cuePlace = useCallback(
    (next: Scene) => {
      sceneRef.current = next;
      if (sendRealtime(liveWalked(next))) worldLog("live walked", next.speaker);
    },
    [sendRealtime],
  );

  const start = useCallback(async () => {
    const here = districtKey(sceneRef.current);
    if ((boot.active || boot.starting) && boot.district && boot.district !== here) {
      worldLog("live city change, remint", boot.district, "→", here);
      tearDown();
    }
    if (boot.starting || boot.active || starting.current || activeRef.current) {
      if (boot.active || activeRef.current) {
        wsRef.current = boot.ws;
        streamRef.current = boot.stream;
        setupDone.current = true;
        setConnecting(false);
        setActive(true);
      }
      return;
    }
    boot.starting = true;
    boot.gen += 1;
    liveGen.current = boot.gen;
    starting.current = true;
    setConnecting(true);
    setError(null);
    setupDone.current = false;
    playerRef.current.ensure();
    ctxRef.current = streetCapContext();
    if (ctxRef.current?.state === "suspended") void ctxRef.current.resume();
    try {
      worldLog("live mint", sceneRef.current.id);
      const minted = await fetch("/api/v1/live/session", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: sceneRef.current.id }),
      });
      const body = (await minted.json()) as {
        token?: string;
        model?: string;
        ws?: string;
        source?: string;
        error?: string;
      };
      if (!starting.current) {
        boot.starting = false;
        return;
      }
      if (!minted.ok || !body.token || !body.ws || !body.model) {
        throw new Error(body.error ?? "Could not open session.");
      }
      worldLog("live token ok", body.source ?? "indilingo");
      const model = body.model.startsWith("models/") ? body.model : `models/${body.model}`;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!starting.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      boot.stream = stream;
      const ws = new WebSocket(body.ws);
      wsRef.current = ws;
      boot.ws = ws;
      boot.district = districtKey(sceneRef.current);
      await new Promise<void>((resolve, reject) => {
        let opened = false;
        ws.onopen = () => {
          opened = true;
          resolve();
        };
        ws.onerror = () => reject(new Error("Live speech socket failed."));
        ws.onclose = () => {
          if (!opened) reject(new Error("Live speech socket closed."));
        };
      });
      worldLog("live socket open");
      if (!starting.current) {
        ws.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      playerRef.current.ensure();
      ws.send(
        JSON.stringify({
          setup: {
            model,
            generationConfig: { responseModalities: ["AUDIO"] },
          },
        }),
      );
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Live speech setup timed out.")), 12_000);
        const fail = (reason: string) => {
          window.clearTimeout(timer);
          reject(new Error(reason));
        };
        ws.onmessage = (event) => {
          void readWsText(event).then((raw) => {
            if (!raw) return;
            let msg: ServerMsg;
            try {
              msg = JSON.parse(raw) as ServerMsg;
            } catch {
              return;
            }
            if (msg.error?.message) {
              fail(msg.error.message);
              return;
            }
            if (!msg.setupComplete) return;
            window.clearTimeout(timer);
            ws.onmessage = (next) => {
              void readWsText(next).then((text) => {
                if (text) handleMessage(text);
              });
            };
            resolve();
          });
        };
        ws.onerror = () => fail("Live speech socket failed.");
        ws.onclose = (event) => fail(liveCloseError(event.code, event.reason));
      });
      if (!starting.current) {
        ws.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      worldLog("live setupComplete");
      setupDone.current = true;
      activeRef.current = true;
      boot.active = true;
      boot.starting = false;
      pausedRef.current = false;
      ws.onclose = () => {
        if (!activeRef.current) return;
        setError("Live call ended.");
        tearDown();
      };
      speakFirst(sceneRef.current);
      await startMic(ws, stream);
      if (!starting.current) {
        ws.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      starting.current = false;
      setConnecting(false);
      setPaused(false);
      setListening(true);
      setActive(true);
      worldLog("live speak first + mic");
    } catch (err) {
      worldLog("live failed", err);
      tearDown();
      setError(err instanceof Error ? err.message : "Live speech failed.");
    }
  }, [handleMessage, speakFirst, startMic, tearDown]);

  const stop = useCallback(() => {
    tearDown();
  }, [tearDown]);

  const pause = useCallback(() => {
    if (!activeRef.current || pausedRef.current) return;
    pausedRef.current = true;
    playerRef.current.muted = true;
    playerRef.current.clear();
    setPaused(true);
    setSpeaking(false);
    setListening(false);
    worldLog("live pause");
  }, []);

  const resume = useCallback(() => {
    if (!activeRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    playerRef.current.muted = false;
    playerRef.current.ensure();
    setPaused(false);
    setListening(true);
    if (sendRealtime(liveResume(sceneRef.current))) worldLog("live resume");
  }, [sendRealtime]);

  const togglePause = useCallback(() => {
    if (pausedRef.current) resume();
    else pause();
  }, [pause, resume]);

  const toggle = useCallback(() => {
    if (starting.current || activeRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    playerRef.current = boot.player;
    if (boot.active) {
      activeRef.current = true;
      setupDone.current = true;
      setActive(true);
      setConnecting(false);
    } else if (boot.starting) {
      setConnecting(true);
    }
  }, []);

  return {
    available: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    active,
    connecting,
    listening,
    speaking,
    paused,
    interim,
    error,
    start,
    stop,
    pause,
    resume,
    togglePause,
    speakFirst,
    cuePlace,
    toggle,
  };
}
