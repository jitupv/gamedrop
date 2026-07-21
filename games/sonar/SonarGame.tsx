"use client";

import { useEffect, useRef, useState } from "react";
import { LEVELS, SonarLevel, genMaze } from "./engine";
import { dayNumber, todayKey } from "@/lib/sdk/daily";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { buildShare, shareResult } from "@/lib/sdk/share";
import Countdown from "@/components/Countdown";

const CW = 900;
const CH = 600;
const PING_MAX_R = 4.6; // in cells
const PING_LIFE = 1.7; // seconds
const SPEED_CELLS = 5.2; // cells per second

type Phase = "playing" | "levelDone" | "dayDone";

interface Ping {
  x: number;
  y: number;
  t: number;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export default function SonarGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [levelIdx, setLevelIdx] = useState(0);
  const [pings, setPings] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [levelStats, setLevelStats] = useState<{ pings: number; time: number }[]>([]);

  const levelRef = useRef<SonarLevel | null>(null);
  const playerRef = useRef({ x: 0, y: 0 });
  const pingsRef = useRef<Ping[]>([]);
  const bumpsRef = useRef<{ c: number; r: number; t: number }[]>([]);
  const visitedRef = useRef<Set<string>>(new Set());
  const pingCountRef = useRef(0);
  const levelStartRef = useRef(0);
  const phaseRef = useRef<Phase>("playing");
  const levelIdxRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const dayRef = useRef("");
  const statsRef = useRef<{ pings: number; time: number }[]>([]);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const geom = (lv: SonarLevel) => {
    const cell = Math.min(Math.floor((CW - 20) / lv.cols), Math.floor((CH - 20) / lv.rows));
    const ox = (CW - cell * lv.cols) / 2;
    const oy = (CH - cell * lv.rows) / 2;
    return { cell, ox, oy };
  };

  const startLevel = (idx: number) => {
    const lv = genMaze(dayRef.current, idx);
    levelRef.current = lv;
    levelIdxRef.current = idx;
    const { cell, ox, oy } = geom(lv);
    playerRef.current = { x: ox + (lv.start.c + 0.5) * cell, y: oy + (lv.start.r + 0.5) * cell };
    pingsRef.current = [];
    bumpsRef.current = [];
    visitedRef.current = new Set();
    pingCountRef.current = 0;
    levelStartRef.current = performance.now();
    setLevelIdx(idx);
    setPings(0);
    setElapsed(0);
    setPhaseBoth("playing");
  };

  const doPing = () => {
    if (phaseRef.current !== "playing") return;
    pingsRef.current.push({ x: playerRef.current.x, y: playerRef.current.y, t: performance.now() });
    pingCountRef.current += 1;
    setPings(pingCountRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(dayNumber());
    setStreak(getStreak("sonar", dayRef.current));
    startLevel(0);
    if (!window.localStorage.getItem("gd:sonar:help")) setShowHelp(true);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;

    const toGame = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * CW, y: ((e.clientY - rect.top) / rect.height) * CH };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointerRef.current = toGame(e);
    };
    const onMove = (e: PointerEvent) => {
      if (pointerRef.current) pointerRef.current = toGame(e);
    };
    const onUp = () => {
      pointerRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        doPing();
        return;
      }
      keysRef.current.add(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    let last = performance.now();
    let hudTick = 0;

    const isWall = (lv: SonarLevel, c: number, r: number) =>
      c < 0 || r < 0 || c >= lv.cols || r >= lv.rows || lv.grid[r][c] === 1;

    const collide = (lv: SonarLevel, cell: number, ox: number, oy: number, x: number, y: number) => {
      const rad = cell * 0.3;
      for (const [dx, dy] of [
        [rad, 0],
        [-rad, 0],
        [0, rad],
        [0, -rad],
        [rad * 0.7, rad * 0.7],
        [-rad * 0.7, rad * 0.7],
        [rad * 0.7, -rad * 0.7],
        [-rad * 0.7, -rad * 0.7],
      ]) {
        const c = Math.floor((x + dx - ox) / cell);
        const r = Math.floor((y + dy - oy) / cell);
        if (isWall(lv, c, r)) return { c, r };
      }
      return null;
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const lv = levelRef.current;
      if (!lv) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { cell, ox, oy } = geom(lv);
      const p = playerRef.current;

      // ---- movement ----
      if (phaseRef.current === "playing") {
        let vx = 0;
        let vy = 0;
        const k = keysRef.current;
        if (k.has("ArrowLeft") || k.has("a")) vx -= 1;
        if (k.has("ArrowRight") || k.has("d")) vx += 1;
        if (k.has("ArrowUp") || k.has("w")) vy -= 1;
        if (k.has("ArrowDown") || k.has("s")) vy += 1;
        const pt = pointerRef.current;
        if (pt) {
          const dx = pt.x - p.x;
          const dy = pt.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > 8) {
            vx = dx / d;
            vy = dy / d;
          }
        }
        const vlen = Math.hypot(vx, vy);
        if (vlen > 0) {
          vx /= vlen;
          vy /= vlen;
          const step = SPEED_CELLS * cell * dt;
          // axis-separated so we slide along walls
          const nx = p.x + vx * step;
          const hitX = collide(lv, cell, ox, oy, nx, p.y);
          if (!hitX) p.x = nx;
          else bumpsRef.current.push({ c: hitX.c, r: hitX.r, t: now });
          const ny = p.y + vy * step;
          const hitY = collide(lv, cell, ox, oy, p.x, ny);
          if (!hitY) p.y = ny;
          else bumpsRef.current.push({ c: hitY.c, r: hitY.r, t: now });
        }
        visitedRef.current.add(`${Math.floor((p.x - ox) / cell)},${Math.floor((p.y - oy) / cell)}`);

        // win check
        const ex = ox + (lv.exit.c + 0.5) * cell;
        const ey = oy + (lv.exit.r + 0.5) * cell;
        if (Math.hypot(ex - p.x, ey - p.y) < cell * 0.45) {
          const time = (now - levelStartRef.current) / 1000;
          const stat = { pings: pingCountRef.current, time };
          statsRef.current = [...statsRef.current];
          statsRef.current[levelIdxRef.current] = stat;
          setLevelStats([...statsRef.current]);
          if (levelIdxRef.current >= LEVELS.length - 1) {
            const totalPings = statsRef.current.reduce((a, s) => a + (s?.pings || 0), 0);
            saveResult("sonar", dayRef.current, { score: totalPings, won: true });
            setStreak(getStreak("sonar", dayRef.current));
            setPhaseBoth("dayDone");
          } else {
            setPhaseBoth("levelDone");
          }
        }

        hudTick++;
        if (hudTick % 20 === 0) setElapsed((now - levelStartRef.current) / 1000);
      }

      // ---- render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, 0, CW, CH);

      // breadcrumbs
      ctx.fillStyle = "rgba(246,241,231,0.045)";
      for (const key of visitedRef.current) {
        const [c, r] = key.split(",").map(Number);
        ctx.fillRect(ox + c * cell + cell * 0.35, oy + r * cell + cell * 0.35, cell * 0.3, cell * 0.3);
      }

      // walls revealed by pings and bumps
      const activePings = pingsRef.current.filter((pg) => (now - pg.t) / 1000 < PING_LIFE);
      pingsRef.current = activePings;
      const activeBumps = bumpsRef.current.filter((b) => (now - b.t) / 1000 < 0.5);
      bumpsRef.current = activeBumps;
      const maxR = PING_MAX_R * cell;
      for (let r = 0; r < lv.rows; r++) {
        for (let c = 0; c < lv.cols; c++) {
          if (lv.grid[r][c] !== 1) continue;
          const wx = ox + (c + 0.5) * cell;
          const wy = oy + (r + 0.5) * cell;
          let alpha = 0;
          for (const pg of activePings) {
            const age = (now - pg.t) / 1000;
            const d = Math.hypot(wx - pg.x, wy - pg.y);
            const ringR = (age / PING_LIFE) * maxR * 1.4;
            if (d < ringR) alpha = Math.max(alpha, (1 - age / PING_LIFE) * Math.max(0, 1 - d / maxR));
          }
          for (const b of activeBumps) {
            if (b.c === c && b.r === r) alpha = Math.max(alpha, (1 - (now - b.t) / 500) * 0.9);
          }
          if (alpha > 0.01) {
            ctx.fillStyle = `hsla(35 22% 72% / ${alpha * 0.85})`;
            ctx.beginPath();
            ctx.roundRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2, 3);
            ctx.fill();
          }
        }
      }

      // expanding ping rings
      for (const pg of activePings) {
        const age = (now - pg.t) / 1000;
        const ringR = (age / PING_LIFE) * maxR * 1.4;
        ctx.strokeStyle = `rgba(232,194,104,${(1 - age / PING_LIFE) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pg.x, pg.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // exit: soft gold glow, always faintly visible through the dark
      const ex = ox + (lv.exit.c + 0.5) * cell;
      const ey = oy + (lv.exit.r + 0.5) * cell;
      const pulse = 0.55 + Math.sin(now * 0.004) * 0.2;
      const g = ctx.createRadialGradient(ex, ey, 1, ex, ey, cell * 1.6);
      g.addColorStop(0, `rgba(232,194,104,${pulse})`);
      g.addColorStop(1, "rgba(232,194,104,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8c268";
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.16, 0, Math.PI * 2);
      ctx.fill();

      // player
      ctx.fillStyle = "rgba(246,241,231,0.18)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6f1e7";
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.24, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPings = levelStats.reduce((a, s) => a + (s?.pings || 0), 0);
  const totalTime = levelStats.reduce((a, s) => a + (s?.time || 0), 0);
  const prior = typeof window !== "undefined" && dayRef.current ? loadResult("sonar", dayRef.current) : null;

  const share = async () => {
    // one line per maze: pings spent in the dark, time to daylight
    const lines = levelStats.map((s) => `🔦×${s?.pings ?? 0} 🌑 ${fmtTime(s?.time ?? 0)}`);
    const text = buildShare("SONAR", num, [...lines, `${totalPings} pings total · out alive`]);
    const outcome = await shareResult(text);
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const restartDay = () => {
    statsRef.current = [];
    setLevelStats([]);
    startLevel(0);
  };

  return (
    <div className="relative w-full">
      <div className="stat-bar">
        <div className="stat">
          <span className="lab">Maze</span>
          <span className="val">{levelIdx + 1}/3</span>
        </div>
        <div className="stat">
          <span className="lab">Pings</span>
          <span className="val">{pings}</span>
        </div>
        <div className="stat">
          <span className="lab">Time</span>
          <span className="val">{fmtTime(elapsed)}</span>
        </div>
        <div className="stat">
          <span className="lab">Streak</span>
          <span className="val">{streak}🔥</span>
        </div>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} className="board" style={{ aspectRatio: `${CW}/${CH}` }} />
        <button
          onClick={doPing}
          className="btn-ink absolute bottom-3 right-3 w-14 h-14 rounded-full text-lg"
          aria-label="Ping"
        >
          ᯤ
        </button>
      </div>

      <p className="hint">
        hold &amp; drag to move<span className="hidden sm:inline"> (or WASD/arrows)</span> · ping
        <span className="hidden sm:inline"> (space)</span> to see · fewer pings = glory ·{" "}
        <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {showHelp && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4 text-center">How to play</h2>
            <ol className="space-y-3 text-stone-600 text-sm leading-relaxed">
              <li>
                <span className="text-stone-900 font-semibold">1. You&apos;re in a pitch-black maze.</span>{" "}
                Only the golden exit glows in the distance.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">2. Hold &amp; drag to move</span> toward
                your finger (or use WASD / arrow keys).
              </li>
              <li>
                <span className="text-stone-900 font-semibold">3. Ping to see.</span> The wave reveals
                nearby walls, then fades. Memorize fast — every ping counts against you.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">4. Three mazes a day,</span> each bigger.
                Fewest total pings wins the bragging rights.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:sonar:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it — into the dark
            </button>
          </div>
        </div>
      )}

      {phase === "levelDone" && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel text-center max-w-sm">
            <div className="text-4xl mb-2">🔦</div>
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">Maze {levelIdx + 1} escaped</h2>
            <p className="text-stone-600 mb-5">
              {levelStats[levelIdx]?.pings} pings · {fmtTime(levelStats[levelIdx]?.time || 0)}
            </p>
            <button onClick={() => startLevel(levelIdx + 1)} className="btn-ink px-6 py-2.5">
              Maze {levelIdx + 2} — deeper &amp; darker →
            </button>
            <p className="text-xs text-stone-400 mt-4">Same mazes for everyone today.</p>
          </div>
        </div>
      )}

      {phase === "dayDone" && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel text-center max-w-sm">
            <div className="text-4xl mb-2">🌅</div>
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">Out of the dark</h2>
            <p className="text-stone-600 mb-1">
              SONAR #{num}: <span className="text-stone-900 font-bold">{totalPings} pings</span> ·{" "}
              {fmtTime(totalTime)}
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={share} className="btn-ink px-5 py-2.5">
                {copied ? "Shared ✓" : "Share result"}
              </button>
              <button onClick={restartDay} className="btn-line px-5 py-2.5">
                Beat it
              </button>
            </div>
            {prior?.won && (
              <p className="text-xs text-stone-400 mt-3">Today&apos;s best: {prior.score} pings</p>
            )}
            <p className="text-xs text-stone-400 mt-2">
              <Countdown prefix="New mazes in" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
