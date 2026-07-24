// Global sound switch - one setting, respected by every game.
export function isMuted(): boolean {
  try {
    return window.localStorage.getItem("gd:muted") === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem("gd:muted", muted ? "1" : "0");
  } catch {}
}

// ---- shared tiny synth - every game's sound effects, one mute switch ----

let actx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  try {
    if (!actx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    return null;
  }
}

// short tone at a fixed pitch
export function blip(freq: number, dur = 0.1, type: OscillatorType = "triangle", gain = 0.07): void {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

// pitch slide - whooshes, pings, falls
export function chirp(
  from: number,
  to: number,
  dur = 0.25,
  type: OscillatorType = "sine",
  gain = 0.07
): void {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}
