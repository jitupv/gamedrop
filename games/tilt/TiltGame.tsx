"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { useEffect, useRef, useState } from "react";
import {
  Dir,
  LEVELS,
  MoveResult,
  SIZE,
  Step,
  TOTAL_LEVELS,
  TiltState,
  applyMove,
  hasAnyMove,
  newLevel,
  previewMove,
} from "./engine";
import GuideLink from "@/components/GuideLink";
import { reportLevelProgress } from "@/lib/sdk/leaderboard";
import { isMuted } from "@/lib/sdk/sound";
import { applyView } from "@/lib/sdk/viewport";
import Celebration from "@/components/Celebration";
import { hashSeed } from "@/lib/sdk/rng";
import {
  readWeeklyProgress,
  weekLabel,
  weeklySeed,
  writeWeeklyProgress,
} from "@/lib/sdk/weekly";

const TILE = 80;
const GAP = 8;
const PAD = 10;
const BOARD = SIZE * TILE + (SIZE - 1) * GAP + PAD * 2; // canvas logical size

// muted editorial palette - tiles match the paper UI; each color also gets a
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

type Phase = "playing" | "levelClear" | "levelFail" | "allDone";

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

function transformCell(c: number, r: number, variant: number): { c: number; r: number } {
  let tc = c;
  let tr = r;
  if (variant & 4) [tc, tr] = [tr, tc];
  if (variant & 1) tc = SIZE - 1 - tc;
  if (variant & 2) tr = SIZE - 1 - tr;
  return { c: tc, r: tr };
}

function toLogicalDir(dir: Dir, variant: number): Dir {
  let dx = dir.dx;
  let dy = dir.dy;
  if (variant & 1) dx = -dx as Dir["dx"];
  if (variant & 2) dy = -dy as Dir["dy"];
  if (variant & 4) [dx, dy] = [dy, dx];
  return { dx, dy };
}

class Sfx {
  private ctx: AudioContext | null = null;
  ensure() {
    if (!this.ctx && typeof window !== "undefined") {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }
  private blip(freq: number, dur: number, type: OscillatorType, gain: number) {
    if (!this.ctx || isMuted()) return;
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
  const [levelIdx, setLevelIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(LEVELS[0].moves);
  const [phase, setPhase] = useState<Phase>("playing");
  const [showHelp, setShowHelp] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [lastStars, setLastStars] = useState(1);

  const stateRef = useRef<TiltState | null>(null);
  const tilesRef = useRef<Map<number, TileV>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const floatsRef = useRef<FloatText[]>([]);
  const shakeRef = useRef(0);
  const phaseRef = useRef<Phase>("playing");
  const levelIdxRef = useRef(0);
  const scoreRef = useRef(0);
  const movesRef = useRef(LEVELS[0].moves);
  const completedRef = useRef(0);
  const playRef = useRef<{ steps: Step[]; i: number; start: number; result: MoveResult } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<{
    key: string;
    dir: Dir;
    dest: Map<number, { r: number; c: number }>;
    popIds: Set<number>;
  } | null>(null);
  const sfxRef = useRef(new Sfx());
  const variantRef = useRef(hashSeed(weeklySeed("tilt")) % 8);
  const colorShiftRef = useRef(hashSeed(`${weeklySeed("tilt")}:colors`) % COLORS.length);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const displayPosition = (c: number, r: number) => {
    const cell = transformCell(c, r, variantRef.current);
    return { x: cellX(cell.c), y: cellY(cell.r) };
  };

  const syncTiles = () => {
    const st = stateRef.current;
    if (!st) return;
    const map = new Map<number, TileV>();
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const t = st.grid[r][c];
        if (!t) continue;
        const pos = displayPosition(c, r);
        map.set(t.id, {
          id: t.id,
          color: t.c,
          x: pos.x,
          y: pos.y,
          fx: pos.x,
          fy: pos.y,
          tx: pos.x,
          ty: pos.y,
          scale: 1,
          spawning: false,
          popping: false,
        });
      }
    tilesRef.current = map;
  };

  const startLevel = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(TOTAL_LEVELS - 1, idx));
    if (safeIdx > completedRef.current) return;
    stateRef.current = newLevel(safeIdx);
    levelIdxRef.current = safeIdx;
    scoreRef.current = 0;
    movesRef.current = LEVELS[safeIdx].moves;
    setLevelIdx(safeIdx);
    setScore(0);
    setMovesLeft(LEVELS[safeIdx].moves);
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
        color: COLORS[(colorIdx + colorShiftRef.current) % COLORS.length],
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
    movesRef.current -= 1;
    setMovesLeft(movesRef.current);
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

    const cfg = LEVELS[levelIdxRef.current];
    if (scoreRef.current >= cfg.target) {
      const earned =
        movesRef.current >= cfg.threeStarSpare
          ? 3
          : movesRef.current >= cfg.twoStarSpare
            ? 2
            : 1;
      setLastStars(earned);
      sfxRef.current.win();
      const nextCompleted = Math.max(completedRef.current, levelIdxRef.current + 1);
      completedRef.current = nextCompleted;
      setCompleted(nextCompleted);
      writeWeeklyProgress("tilt", nextCompleted);
      reportLevelProgress("tilt", nextCompleted);
      setPhaseBoth(levelIdxRef.current >= TOTAL_LEVELS - 1 ? "allDone" : "levelClear");
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

    const saved = readWeeklyProgress("tilt");
    completedRef.current = saved;
    setCompleted(saved);
    startLevel(Math.min(saved, TOTAL_LEVELS - 1));

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
      const displayDir = dirFromDelta(e.clientX - s.x, e.clientY - s.y);
      if (!displayDir) {
        previewRef.current = null;
        return;
      }
      const key = `${displayDir.dx},${displayDir.dy}`;
      if (previewRef.current?.key === key) return;
      const dir = toLogicalDir(displayDir, variantRef.current);
      const pv = previewMove(st, dir);
      previewRef.current = {
        key,
        dir: displayDir,
        dest: new Map(pv.dest.map((d) => [d.id, { r: d.toR, c: d.toC }])),
        popIds: new Set(pv.popIds),
      };
    };
    const onUp = (e: PointerEvent) => {
      const s = swipeRef.current;
      swipeRef.current = null;
      previewRef.current = null;
      if (!s) return;
      const displayDir = dirFromDelta(e.clientX - s.x, e.clientY - s.y);
      if (displayDir) doMove(toLogicalDir(displayDir, variantRef.current));
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
        doMove(toLogicalDir(dir, variantRef.current));
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);

    if (!window.localStorage.getItem("gd:tilt:help:v2")) setShowHelp(true);

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
            const pos = displayPosition(m.toC, m.toR);
            if (tv.tx !== pos.x || tv.ty !== pos.y) {
              tv.fx = tv.x;
              tv.fy = tv.y;
              tv.tx = pos.x;
              tv.ty = pos.y;
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
            const cx =
              step.cells.reduce((sum, cell) => sum + displayPosition(cell.c, cell.r).x, 0) /
                step.cells.length +
              TILE / 2;
            const cy =
              step.cells.reduce((sum, cell) => sum + displayPosition(cell.c, cell.r).y, 0) /
                step.cells.length +
              TILE / 2;
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
              const pos = displayPosition(sp.c, sp.r);
              tv = {
                id: sp.id,
                color: sp.color,
                x: pos.x,
                y: pos.y,
                fx: pos.x,
                fy: pos.y,
                tx: pos.x,
                ty: pos.y,
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
      applyView(canvas, ctx, BOARD, BOARD, false, "#efe8db");
      if (shakeRef.current > 0) {
        shakeRef.current *= 0.86;
        if (shakeRef.current < 0.3) shakeRef.current = 0;
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      }

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
        // color-tinted ghost at every destination - the future board, readable at a glance
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        for (const [id, cell] of pv.dest) {
          const gtv = tilesRef.current.get(id);
          const col = gtv
            ? COLORS[(gtv.color + colorShiftRef.current) % COLORS.length]
            : "rgba(41,36,32,0.5)";
          const pos = displayPosition(cell.c, cell.r);
          ctx.globalAlpha = 0.26;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(pos.x + 4, pos.y + 4, TILE - 8, TILE - 8, 12);
          ctx.fill();
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.roundRect(pos.x + 4, pos.y + 4, TILE - 8, TILE - 8, 12);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.setLineDash([]);
      }

      // tiles
      for (const tv of tilesRef.current.values()) {
        const s = tv.scale;
        if (s <= 0) continue;
        const willPop = pv?.popIds.has(tv.id) ?? false;
        if (willPop) {
          // bright halo: these are the tiles that will pop if you release now
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 22;
        }
        const cx = tv.x + TILE / 2 + leanX;
        const cy = tv.y + TILE / 2 + leanY;
        const half = (TILE / 2 - 2) * s;
        const displayColor = (tv.color + colorShiftRef.current) % COLORS.length;
        ctx.fillStyle = COLORS[displayColor];
        ctx.beginPath();
        ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 14 * s);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(41,36,32,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 14 * s);
        ctx.stroke();
        if (s > 0.3) drawSymbol(ctx, displayColor, cx, cy, half * 0.42);
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
  const nextUnlocked = levelIdx < TOTAL_LEVELS - 1 && levelIdx + 1 <= completed;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="stat-bar shrink-0">
        <div className="stat">
          <span className="lab">Level</span>
          <span className="val">{levelIdx + 1}</span>
        </div>
        <div className="stat">
          <span className="lab">Completed</span>
          <span className="val">{completed}</span>
        </div>
        <div className="stat">
          <span className="lab">Moves</span>
          <span className={`val${movesLeft <= 3 ? " warn" : ""}`}>{movesLeft}</span>
        </div>
        <div className="stat">
          <span className="lab">Score</span>
          <span className="val">
            {score.toLocaleString()}
            <span className="tx-soft font-medium"> / {cfg.target.toLocaleString()}</span>
          </span>
        </div>
        <div className="stat">
          <span className="lab">Colors</span>
          <span className="val">{cfg.colors}</span>
        </div>
        <div className="stat">
          <span className="lab">Week</span>
          <span className="val">{weekLabel()}</span>
        </div>
      </div>
      <div className="h-1 bg-line overflow-hidden shrink-0">
        <div
          className="h-full rounded-full bg-amber-700 transition-all duration-300"
          style={{ width: `${Math.min(100, (score / cfg.target) * 100)}%` }}
        />
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
      </div>
      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button
          onClick={() => startLevel(levelIdx - 1)}
          disabled={levelIdx === 0}
          className="btn-line px-4 py-2 disabled:opacity-40"
        >
          Prev
        </button>
        <button onClick={() => startLevel(levelIdx)} className="btn-line px-4 py-2">
          Restart
        </button>
        <button
          onClick={() => startLevel(levelIdx + 1)}
          disabled={!nextUnlocked}
          className="btn-line px-4 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <p className="hint shrink-0">
        drag and hold to preview - release to move
        <span className="hidden sm:inline"> - arrow keys work too</span> - 3 stars with{" "}
        {cfg.threeStarSpare}+ moves left -{" "}
        <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {showHelp && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <button
              className="panel-x"
              aria-label="Close"
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:tilt:help:v2", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">
              How to play
            </h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. Swipe any direction.</span> The{" "}
                <em>whole board</em> slides that way - every tile packs toward that edge.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Hold before releasing.</span>{" "}
                Dashed boxes show where tiles will land, and tiles that{" "}
                <span className="tx-ink font-semibold">glow</span> are about to pop.
                Release to commit, or drag another way to compare.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Line up 3+ of a color</span> (row
                or column) and they pop. Pops make tiles slide again - chains multiply your points.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Hit the target</span> before your
                moves run out. Spare {cfg.twoStarSpare}+ moves for 2 stars or{" "}
                {cfg.threeStarSpare}+ for 3 stars.
              </li>
              <li>
                <span className="tx-ink font-semibold">5. Keep climbing.</span>{" "}
                Target scores rise, moves tighten, and the board grows from 4 to 6 colors.
                Every Monday rotates, reflects, and recolors the fixed boards without
                changing their solution quality. Weekly depth is ranked and your career best remains saved.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:tilt:help:v2", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - let&apos;s play
            </button>
            <GuideLink game="tilt" />
          </div>
        </div>
      )}

      {phase === "levelClear" && (
        <Celebration
          title={`Level ${levelIdx + 1} complete!`}
          share={{ game: "tilt", level: levelIdx + 1 }}
          stars={lastStars}
          score={{ label: "points", value: score }}
          badges={[
            `${movesLeft} move${movesLeft === 1 ? "" : "s"} spared`,
            `${completed} completed this week`,
          ]}
          primary={{ label: `Level ${levelIdx + 2} ->`, onClick: () => startLevel(levelIdx + 1) }}
          secondary={{ label: "Replay level", onClick: () => startLevel(levelIdx) }}
          footnote={`Stars: 3 with ${cfg.threeStarSpare}+ moves left, 2 with ${cfg.twoStarSpare}+, 1 for completing the target.`}
        />
      )}

      {phase === "levelFail" && (
        <Overlay emoji="😮‍💨" title="Out of moves" sub={`${score.toLocaleString()} / ${cfg.target.toLocaleString()} - so close`}>
          <button onClick={() => startLevel(levelIdx)} className="btn-ink px-6 py-2.5">
            Retry level {levelIdx + 1}
          </button>
        </Overlay>
      )}

      {phase === "allDone" && (
        <Celebration
          title="Weekly TILT run complete!"
          stars={lastStars}
          score={{ label: "levels completed", value: TOTAL_LEVELS }}
          badges={[`${score.toLocaleString()} points on the final challenge`, "Weekly run complete"]}
          primary={{ label: "Replay final level", onClick: () => startLevel(TOTAL_LEVELS - 1) }}
          secondary={{ label: "Back to Level 1", onClick: () => startLevel(0) }}
          feedback="tilt"
          finalWeek
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
  delayMs = 900,
}: {
  emoji: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  delayMs?: number;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), Math.max(0, delayMs));
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!revealed) return null;

  return (
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="panel text-center max-w-sm">
        <div className="text-4xl mb-2">{emoji}</div>
        <h2 className="font-serif text-2xl font-bold tx-ink mb-1">{title}</h2>
        <p className="tx-muted mb-5">{sub}</p>
        {children}
        <p className="text-xs tx-soft mt-4">Restart the fixed level and try a different slide sequence.</p>
      </div>
    </div>
  );
}
