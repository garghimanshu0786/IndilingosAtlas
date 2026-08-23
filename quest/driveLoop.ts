
let tick: (() => void) | null = null;

export function registerDriveTick(fn: () => void) {
  tick = fn;
}

export function unregisterDriveTick() {
  tick = null;
}

export function runDriveTick() {
  tick?.();
}
