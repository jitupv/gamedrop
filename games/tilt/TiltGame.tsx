"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dir,
  LEVELS,
  MoveResult,
  SIZE,
  Step,
  TiltState,
  applyMove,
  hasAnyMove,
  newBoard,
  newLevel,
  previewMove,
} from "./engine";
import { dayNumber, todayKey } from "@/lib/sdk/daily";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { buildShare, challengeUrl, shareResult } from "@/lib/sdk/share";
import Celebration from "@/components/Celebration";

const TILE = 80;
const GAP = 8;
const PAD = 10;
const BOARD = SIZE * TILE + (SIZE - 1) * GAP + PAD * 2; // canvas logical size

// muted editorial palette — tiles match the paper UI; each color also gets a
// tone-on-tone symbol so types read without relying on color alone
const COLORS = ["#c96f4a", "#d9a441", "#8a9a5b", "#6f8fa8", "#9d7a94", "#b25d6d"];
const DARKS = ["#8d4a2e", "#97701f", "#5c683a", "#48626f", "#6b5064", "#7d3d4a"];
const CHAIN_WORDS = ["", "NICE!", "CHAIN x2!", "CHAIN x3!", "HUGE x4!", "INSANE x5!", "GODLIKE x6!"];

function drawSymbol(ctx: CanvasRenderingContext2D, kind: number, cx: number, cy: number, r: number) {
  ctx.fillStyle = DARKS[kind % DARKS.length];
  ctx.strokeStyle = DARKS[kind % DARKS.length];
  ctx.beginPath();
  switch (kind % 6) {
    case 0: // ring
      ctx.lineWidth = r * 0.42;
      ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 1: // triangle
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.75, cy + r * 0.55);
      ctx.lineTo(cx - r * 0.75, cy + r * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    case 2: // diamond
      ctx.moveTo(cx, cy - r * 0.85);
      ctx.lineTo(cx + r * 0.85, cy);
      ctx.lineTo(cx, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.85, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case 3: // square
      ctx.roundRect(cx - r * 0.6, cy - r * 0.6, r * 1.2, r * 1.2, r * 0.18);
      ctx.fill();
      break;
    case 4: // plus
      ctx.roundRect(cx - r * 0.22, cy - r * 0.8, r * 0.44, r * 1.6, r * 0.12);
      ctx.roundRect(cx - r * 0.8, cy - r * 0.22, r * 1.6, r * 0.44, r * 0.12);
      ctx.fill();
      break;
    default: // four-point sparkle
      ctx.moveTo(cx, cy - r * 0.9);
      ctx.quadraticCurveTo(cx, cy, cx + r * 0.9, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + r * 0.9);
      ctx.quadraticCurveTo(cx, cy, cx - r * 0.9, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - r * 0.9);
      ctx.fill();
  }
}

type Phase = "playing" | "levelClear" | "levelFail" | "dayDone" | "endlessOver";
type Mode = "daily" | "endless";

function readTiltEndlessBest(): number {
  try {
    return Number(window.localStorage.getItem("gd:tilt:endless-best") || 0);
  } catch {
    return 0;
  }
}

interface TileV {
  id: number;
  color: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  scale: number;
  spawning: boolean;
  popping: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  big: boolean;
}

const cellX = (c: number) => PAD + c * (TILE + GAP);
const cellY = (r: number) => PAD + r * (TILE + GAP);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

class Sfx {
  private ctx: AudioContext | null = null;
  ensure() {
    if (!this.ctx && typeof window !== "undefined") {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }
  private blip(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }
  slide() {
    this.blip(150, 0.05, "sine", 0.03);
  }
  pop(chain: number, n: number) {
    this.blip(260 + chain * 90 + n * 8, 0.09, "triangle", 0.09);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.14, "triangle", 0.08), i * 90));
  }
  fail() {
    [300, 220, 150].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.16, "sawtooth", 0.04), i * 120));
  }
}

export default function TiltGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [levelIdx, setLevelIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(LEVELS[0].moves);
  const [phase, setPhase] = useState<Phase>("playing");
  const [dayTotal, setDayTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [levelStars, setLevelStars] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("daily");
  const [endlessBest, setEndlessBest] = useState(0);

  const modeRef = useRef<Mode>("daily");
  const starsRef = useRef<number[]>([]);
  const stateRef = useRef<TiltState | null>(null);
  const tilesRef = useRef<Map<number, TileV>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const floatsRef = useRef<FloatText[]>([]);
  const shakeRef = useRef(0);
  const phaseRef = useRef<Phase>("playing");
  const levelIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const movesRef = useRef(LEVELS[0].moves);
  const dayTotalRef = useRef(0);
  const playRef = useRef<{ steps: Step[]; i: number; start: number; result: MoveResult } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<{
    key: string;
    dir: Dir;
    dest: Map<number, { r: number; c: number }>;
    popIds: Set<number>;
  } | null>(null);
  const sfxRef = useRef(new Sfx());
  const dayRef = useRef("");

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const syncTiles = () => {
    const st = stateRef.current;
    if (!st) return;
    const map = new Map<number, TileV>();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const t = st.grid[r][c];
        if (!t) continue;
        map.set(t.id, {
          id: t.id,
          color: t.c,
          x: cellX(c),
          y: cellY(r),
          fx: cellX(c),
          fy: cellY(r),
          tx: cellX(c),
          ty: cellY(r),
          scale: 1,
          spawning: false,
          popping: false,
        });
      }
    tilesRef.current = map;
  };

  const startLevel = (idx: number) => {
    modeRef.current = "daily";
    setMode("daily");
    stateRef.current = newLevel(dayRef.current, idx);
    levelIdxRef.current = idx;
    scoreRef.current = 0;
    movesRef.current = LEVELS[idx].moves;
    setLevelIdx(idx);
    setScore(0);
    setMovesLeft(LEVELS[idx].moves);
    playRef.current = null;
    particlesRef.current = [];
    floatsRef.current = [];
    syncTiles();
    setPhaseBoth("playing");
  };

  const startEndless = () => {
    modeRef.current = "endless";
    setMode("endless");
    setEndlessBest(readTiltEndlessBest());
    stateRef.current = newBoard(`tilt:endless:${Math.random().toString(36).slice(2, 9)}`, 4);
    levelIdxRef.current = 0;
    scoreRef.current = 0;
    movesRef.current = 9999;
    setLevelIdx(0);
    setScore(0);
    setMovesLeft(9999);
    playRef.current = null;
    particlesRef.current = [];
    floatsRef.current = [];
    syncTiles();
    setPhaseBoth("playing");
  };

  const burst = (x: number, y: number, colorIdx: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.5,
        life: 1,
        color: COLORS[colorIdx % COLORS.length],
        size: 3 + Math.random() * 4,
      });
    }
  };

  const doMove = (dir: Dir) => {
    const st = stateRef.current;
    if (!st || phaseRef.current !== "playing" || playRef.current) return;
    sfxRef.current.ensure();
    const result = applyMove(st, dir);
    if (!result.changed) {
      shakeRef.current = 5; // nudge: that direction does nothing
      return;
    }
    if (modeRef.current === "daily") {
      movesRef.current -= 1;
      setMovesLeft(movesRef.current);
    }
    playRef.current = { steps: result.steps, i: 0, start: performance.now(), result };
    sfxRef.current.slide();
  };

  const finishMove = () => {
    const play = playRef.current;
    if (!play) return;
    playRef.current = null;
    scoreRef.current += play.result.points;
    setScore(scoreRef.current);
    syncTiles();

    const st = stateRef.current;

    if (modeRef.current === "endless") {
      // colors escalate as the run grows — the well has no bottom, only steeper walls
      if (st) st.colors = Math.min(6, 4 + (scoreRef.current >= 3000 ? 1 : 0) + (scoreRef.current >= 8000 ? 1 : 0));
      if (st && !hasAnyMove(st)) {
        sfxRef.current.fail();
        if (scoreRef.current > readTiltEndlessBest()) {
          try {
            window.localStorage.setItem("gd:tilt:endless-best", String(scoreRef.current));
          } catch {}
        }
        setEndlessBest(Math.max(readTiltEndlessBest(), scoreRef.current));
        setPhaseBoth("endlessOver");
      }
      return;
    }

    const cfg = LEVELS[levelIdxRef.current];
    if (scoreRef.current >= cfg.target) {
      // stars: clear = 1, spare moves earn the rest
      const earned = 1 + (movesRef.current >= 2 ? 1 : 0) + (movesRef.current >= 5 ? 1 : 0);
      starsRef.current = [...starsRef.current];
      starsRef.current[levelIdxRef.current] = earned;
      setLevelStars([...starsRef.current]);
      dayTotalRef.current += scoreRef.current;
      setDayTotal(dayTotalRef.current);
      sfxRef.current.win();
      if (levelIdxRef.current >= LEVELS.length - 1) {
        saveResult("tilt", dayRef.current, { score: dayTotalRef.current, won: true });
        setStreak(getStreak("tilt", dayRef.current));
        setPhaseBoth("dayDone");
      } else {
        setPhaseBoth("levelClear");
      }
    } else if (movesRef.current <= 0 || (st && !hasAnyMove(st))) {
      sfxRef.current.fail();
      setPhaseBoth("levelFail");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(dayNumber());
    setStreak(getStreak("tilt", dayRef.current));
    startLevel(0);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = BOARD * dpr;
    canvas.height = BOARD * dpr;

    const dirFromDelta = (dx: number, dy: number): Dir | null => {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return null;
      return Math.abs(dx) > Math.abs(dy) ? { dx: dx > 0 ? 1 : -1, dy: 0 } : { dx: 0, dy: dy > 0 ? 1 : -1 };
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      swipeRef.current = { x: e.clientX, y: e.clientY };
      previewRef.current = null;
    };
    const onMove = (e: PointerEvent) => {
      const s = swipeRef.current;
      const st = stateRef.current;
      if (!s || !st || phaseRef.current !== "playing" || playRef.current) return;
      const dir = dirFromDelta(e.clientX - s.x, e.clientY - s.y);
      if (!dir) {
        previewRef.current = null;
        return;
      }
      const key = `${dir.dx},${dir.dy}`;
      if (previewRef.current?.key === key) return;
      const pv = previewMove(st, dir);
      previewRef.current = {
        key,
        dir,
        dest: new Map(pv.dest.map((d) => [d.id, { r: d.toR, c: d.toC }])),
        popIds: new Set(pv.popIds),
      };
    };
    const onUp = (e: PointerEvent) => {
      const s = swipeRef.current;
      swipeRef.current = null;
      previewRef.current = null;
      if (!s) return;
      const dir = dirFromDelta(e.clientX - s.x, e.clientY - s.y);
      if (dir) doMove(dir);
    };
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowRight: { dx: 1, dy: 0 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowUp: { dx: 0, dy: -1 },
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    if (!window.localStorage.getItem("gd:tilt:help")) setShowHelp(true);

    const STEP_DUR: Record<Step["type"], number> = { slide: 150, pop: 210, spawn: 170 };

    let raf = 0;
    const draw = (now: number) => {
      // ---- advance animation timeline ----
      const play = playRef.current;
      if (play) {
        const step = play.steps[play.i];
        const dur = STEP_DUR[step.type];
        const t = Math.min(1, (now - play.start) / dur);

        if (step.type === "slide") {
          for (const m of step.moves) {
            const tv = tilesRef.current.get(m.id);
            if (!tv) continue;
            if (tv.tx !== cellX(m.toC) || tv.ty !== cellY(m.toR)) {
              tv.fx = tv.x;
              tv.fy = tv.y;
              tv.tx = cellX(m.toC);
              tv.ty = cellY(m.toR);
            }
            tv.x = tv.fx + (tv.tx - tv.fx) * ease(t);
            tv.y = tv.fy + (tv.ty - tv.fy) * ease(t);
          }
        } else if (step.type === "pop") {
          for (const id of step.ids) {
            const tv = tilesRef.current.get(id);
            if (!tv) continue;
            if (!tv.popping) {
              tv.popping = true;
              burst(tv.x + TILE / 2, tv.y + TILE / 2, tv.color, 7);
            }
            tv.scale = t < 0.35 ? 1 + t : Math.max(0, 1.35 * (1 - (t - 0.35) / 0.65));
          }
          if (t === 0 || (t > 0 && !("fired" in step))) {
            // one-shot side effects
            (step as unknown as { fired?: boolean }).fired = true;
            sfxRef.current.pop(step.chain, step.ids.length);
            if (step.chain >= 2) shakeRef.current = Math.min(14, 4 + step.chain * 3);
            const cx = step.cells.reduce((a, c) => a + cellX(c.c), 0) / step.cells.length + TILE / 2;
            const cy = step.cells.reduce((a, c) => a + cellY(c.r), 0) / step.cells.length + TILE / 2;
            floatsRef.current.push({ x: cx, y: cy, text: `+${step.points}`, life: 1, big: false });
            if (step.chain >= 2 || step.ids.length >= 5)
              floatsRef.current.push({
                x: BOARD / 2,
                y: BOARD / 2 - 60,
                text: CHAIN_WORDS[Math.min(step.chain, CHAIN_WORDS.length - 1)] || `CHAIN x${step.chain}!`,
                life: 1,
                big: true,
              });
          }
        } else {
          for (const sp of step.tiles) {
            let tv = tilesRef.current.get(sp.id);
            if (!tv) {
              tv = {
                id: sp.id,
                color: sp.color,
                x: cellX(sp.c),
                y: cellY(sp.r),
                fx: cellX(sp.c),
                fy: cellY(sp.r),
                tx: cellX(sp.c),
                ty: cellY(sp.r),
                scale: 0,
                spawning: true,
                popping: false,
              };
              tilesRef.current.set(sp.id, tv);
            }
            tv.scale = ease(t);
          }
        }

        if (t >= 1) {
          if (step.type === "pop") for (const id of step.ids) tilesRef.current.delete(id);
          play.i += 1;
          play.start = now;
          if (play.i >= play.steps.length) finishMove();
        }
      }

      // ---- render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shakeRef.current > 0) {
        shakeRef.current *= 0.86;
        if (shakeRef.current < 0.3) shakeRef.current = 0;
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      }
      ctx.fillStyle = "#efe8db";
      ctx.fillRect(-20, -20, BOARD + 40, BOARD + 40);

      // empty cells
      ctx.fillStyle = "rgba(41,36,32,0.05)";
      for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
          ctx.beginPath();
          ctx.roundRect(cellX(c), cellY(r), TILE, TILE, 14);
          ctx.fill();
        }

      // drag preview: ghost outlines where tiles will land, glow on tiles that will pop
      const pv = !playRef.current && phaseRef.current === "playing" ? previewRef.current : null;
      const leanX = pv ? pv.dir.dx * 7 : 0;
      const leanY = pv ? pv.dir.dy * 7 : 0;
      if (pv) {
        ctx.strokeStyle = "rgba(41,36,32,0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        for (const [, cell] of pv.dest) {
          ctx.beginPath();
          ctx.roundRect(cellX(cell.c) + 4, cellY(cell.r) + 4, TILE - 8, TILE - 8, 12);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // tiles
      for (const tv of tilesRef.current.values()) {
        const s = tv.scale;
        if (s <= 0) continue;
        const willPop = pv?.popIds.has(tv.id) ?? false;
        if (willPop) {
          ctx.shadowColor = "#292420";
          ctx.shadowBlur = 18;
        }
        const cx = tv.x + TILE / 2 + leanX;
        const cy = tv.y + TILE / 2 + leanY;
        const half = (TILE / 2 - 2) * s;
        ctx.fillStyle = COLORS[tv.color % COLORS.length];
        ctx.beginPath();
        ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 14 * s);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(41,36,32,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 14 * s);
        ctx.stroke();
        if (s > 0.3) drawSymbol(ctx, tv.color, cx, cy, half * 0.42);
      }

      // particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= 0.028;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // floating texts
      const floats = floatsRef.current;
      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.y -= f.big ? 0.4 : 0.9;
        f.life -= f.big ? 0.014 : 0.02;
        if (f.life <= 0) {
          floats.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.font = f.big ? "bold 44px ui-sans-serif, system-ui" : "bold 22px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = f.big ? "#b45309" : "#292420";
        ctx.strokeStyle = "rgba(255,252,246,0.85)";
        ctx.lineWidth = f.big ? 6 : 3;
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = LEVELS[levelIdx];
  const prior = typeof window !== "undefined" && dayRef.current ? loadResult("tilt", dayRef.current) : null;

  const share = async () => {
    const starRow = (s: number) =>
      s >= 3 ? "🟩🟩🟩" : s === 2 ? "🟨🟨⬜" : s === 1 ? "🟧⬜⬜" : "⬜⬜⬜";
    const text = buildShare("TILT", num, [
      ...starsRef.current.map(starRow),
      `🍬 ${dayTotalRef.current.toLocaleString()} pts`,
    ], challengeUrl(dayTotalRef.current));
    const outcome = await shareResult(text);
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const restartDay = () => {
    dayTotalRef.current = 0;
    setDayTotal(0);
    starsRef.current = [];
    setLevelStars([]);
    startLevel(0);
  };

  return (
    <div className="relative w-full">
      <div className="stat-bar">
        {mode === "daily" ? (
          <>
            <div className="stat">
              <span className="lab">Level</span>
              <span className="val">{levelIdx + 1}/3</span>
            </div>
            <div className="stat">
              <span className="lab">Moves</span>
              <span className={`val${movesLeft <= 3 ? " warn" : ""}`}>{movesLeft}</span>
            </div>
            <div className="stat">
              <span className="lab">Score</span>
              <span className="val">
                {score.toLocaleString()}
                <span className="text-stone-400 font-medium"> / {cfg.target.toLocaleString()}</span>
              </span>
            </div>
            <div className="stat">
              <span className="lab">Streak</span>
              <span className="val">{streak}🔥</span>
            </div>
            <button type="button" className="stat stat-btn" onClick={startEndless}>
              <span className="lab">Mode</span>
              <span className="val">Daily ⇄</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" className="stat stat-btn" onClick={restartDay}>
              <span className="lab">Mode</span>
              <span className="val">∞ ⇄</span>
            </button>
            <div className="stat">
              <span className="lab">Score</span>
              <span className="val">{score.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="lab">Colors</span>
              <span className={`val${score >= 3000 ? " warn" : ""}`}>
                {Math.min(6, 4 + (score >= 3000 ? 1 : 0) + (score >= 8000 ? 1 : 0))}
              </span>
            </div>
            <div className="stat">
              <span className="lab">Best</span>
              <span className="val warn">{endlessBest.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
      {mode === "daily" && (
        <div className="h-1 rounded-full bg-stone-300/50 mb-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-700 transition-all duration-300"
            style={{ width: `${Math.min(100, (score / cfg.target) * 100)}%` }}
          />
        </div>
      )}

      <canvas ref={canvasRef} className="board" style={{ aspectRatio: "1/1" }} />
      <p className="hint">
        hold &amp; drag to preview — release to commit
        <span className="hidden sm:inline"> · arrow keys work too</span> ·{" "}
        {mode === "daily" ? (
          <button onClick={startEndless}>endless mode →</button>
        ) : (
          <button onClick={restartDay}>← back to daily</button>
        )}{" "}
        · <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {showHelp && (
        <div className="scrim absolute inset-0 flex items-center justify-center rounded-2xl z-20 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4 text-center">
              How to play
            </h2>
            <ol className="space-y-3 text-stone-600 text-sm leading-relaxed">
              <li>
                <span className="text-stone-900 font-semibold">1. Swipe any direction.</span> The{" "}
                <em>whole board</em> slides that way — every tile packs toward that edge.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">2. Hold before releasing.</span>{" "}
                Dashed boxes show where tiles will land, and tiles that{" "}
                <span className="text-stone-900 font-semibold">glow</span> are about to pop.
                Release to commit, or drag another way to compare.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">3. Line up 3+ of a color</span> (row
                or column) and they pop. Pops make tiles slide again — chains multiply your points.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">4. Hit the target</span> before your
                moves run out. Three levels a day, same boards for everyone.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:tilt:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it — let&apos;s play
            </button>
          </div>
        </div>
      )}

      {phase === "levelClear" && (
        <Celebration
          title={`Level ${levelIdx + 1} complete!`}
          stars={levelStars[levelIdx] || 1}
          score={{ label: "points", value: score }}
          badges={[
            `${movesLeft} move${movesLeft === 1 ? "" : "s"} spared`,
            ...(score >= cfg.target * 1.4 ? ["Target smashed 💥"] : []),
          ]}
          primary={{ label: `Level ${levelIdx + 2} →`, onClick: () => startLevel(levelIdx + 1) }}
          footnote="More colors, less mercy."
        />
      )}

      {phase === "levelFail" && (
        <Overlay emoji="😮‍💨" title="Out of moves" sub={`${score.toLocaleString()} / ${cfg.target.toLocaleString()} — so close`}>
          <button onClick={() => startLevel(levelIdx)} className="btn-ink px-6 py-2.5">
            Retry level {levelIdx + 1}
          </button>
        </Overlay>
      )}

      {phase === "dayDone" && (
        <Celebration
          title={`TILT #${num} complete!`}
          stars={Math.round(levelStars.reduce((a, b) => a + (b || 0), 0) / 3)}
          score={{ label: "total points", value: dayTotal }}
          badges={levelStars.map((s, i) => `L${i + 1}: ${"★".repeat(s)}`)}
          primary={{ label: "Endless mode →", onClick: startEndless }}
          secondary={{ label: copied ? "Shared ✓" : "Share result", onClick: share }}
          footnote={
            prior?.won
              ? `Today's best: ${prior.score.toLocaleString()} · endless has no bottom`
              : "New boards at midnight · endless has no bottom."
          }
          countdown
        />
      )}

      {phase === "endlessOver" && (
        <Celebration
          title="Board jammed!"
          stars={score >= 12000 ? 3 : score >= 6000 ? 2 : score >= 2000 ? 1 : 0}
          score={{ label: "endless score", value: score }}
          badges={[
            score >= endlessBest && score > 0 ? "New best! 🏆" : `Best: ${endlessBest.toLocaleString()}`,
            `${Math.min(6, 4 + (score >= 3000 ? 1 : 0) + (score >= 8000 ? 1 : 0))} colors survived`,
          ]}
          primary={{ label: "Run it back →", onClick: startEndless }}
          secondary={{ label: "← Daily", onClick: restartDay }}
          footnote="The board always wins eventually."
        />
      )}
    </div>
  );
}

function Overlay({
  emoji,
  title,
  sub,
  children,
}: {
  emoji: string;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="panel text-center max-w-sm">
        <div className="text-4xl mb-2">{emoji}</div>
        <h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">{title}</h2>
        <p className="text-stone-600 mb-5">{sub}</p>
        {children}
        <p className="text-xs text-stone-400 mt-4">Same boards for everyone today. New boards at midnight.</p>
      </div>
    </div>
  );
}
