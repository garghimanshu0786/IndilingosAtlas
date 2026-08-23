const KEY = "indilingo-music";

type Bed = {
  stop: () => void;
  duck: (on: boolean) => void;
};

let ctx: AudioContext | null = null;
let bed: Bed | null = null;

export function musicPrefersOn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function storeMusicPref(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
}

function audioContext(): AudioContext {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = ctx ?? new AC();
  return ctx;
}

export function startStreetMusic() {
  if (bed) return;
  const ac = audioContext();
  void ac.resume();

  const master = ac.createGain();
  master.gain.value = 0.06;
  master.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 98;
  const pad = ac.createBiquadFilter();
  pad.type = "lowpass";
  pad.frequency.value = 380;
  const padGain = ac.createGain();
  padGain.gain.value = 0.35;
  osc.connect(pad);
  pad.connect(padGain);
  padGain.connect(master);
  osc.start();

  const fifth = ac.createOscillator();
  fifth.type = "sine";
  fifth.frequency.value = 147;
  const fifthGain = ac.createGain();
  fifthGain.gain.value = 0.12;
  fifth.connect(fifthGain);
  fifthGain.connect(master);
  fifth.start();

  const samples = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, samples, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const air = ac.createBiquadFilter();
  air.type = "bandpass";
  air.frequency.value = 720;
  air.Q.value = 0.65;
  const airGain = ac.createGain();
  airGain.gain.value = 0.16;
  noise.connect(air);
  air.connect(airGain);
  airGain.connect(master);
  noise.start();

  bed = {
    stop() {
      osc.stop();
      fifth.stop();
      noise.stop();
      master.disconnect();
      bed = null;
    },
    duck(on: boolean) {
      master.gain.setTargetAtTime(on ? 0.015 : 0.06, ac.currentTime, 0.12);
    },
  };
}

export function stopStreetMusic() {
  bed?.stop();
}

export function duckStreetMusic(on: boolean) {
  bed?.duck(on);
}
