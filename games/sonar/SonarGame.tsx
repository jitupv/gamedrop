"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { useEffect, useRef, useState } from "react";
import { SonarLevel, TOTAL_LEVELS, genProgressLevel, starsForPings } from "./engine";
import Celebration from "@/components/Celebration";
import GuideLink from "@/components/GuideLink";
import { reportLevelProgress } from "@/lib/sdk/leaderboard";
import { blip, chirp } from "@/lib/sdk/sound";
import { View, applyView, pointToGame } from "@/lib/sdk/viewport";
import {
  readWeeklyProgress,
  weekLabel,
  weeklySeed,
  writeWeeklyProgress,
} from "@/lib/sdk/weekly";

const CW = 900;
const CH = 600;
const SPEED_CELLS = 5.2; // cells per second

type Phase = "playing" | "levelDone" | "allDone";

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
  const [level, setLevel] = useState<SonarLevel | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [pings, setPings] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [completed, setCompleted] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [lastPings, setLastPings] = useState(0);
  const [lastTime, setLastTime] = useState(0);
  const [lastStars, setLastStars] = useState(1);

  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const levelRef = useRef<SonarLevel | null>(null);
  const playerRef = useRef({ x: 0, y: 0 });
  const pingsRef = useRef<Ping[]>([]);
  const bumpsRef = useRef<{ c: number; r: number; t: number }[]>([]);
  const visitedRef = useRef<Set<string>>(new Set());
  const pingCountRef = useRef(0);
  const levelStartRef = useRef(0);
  const phaseRef = useRef<Phase>("playing");
  const levelIdxRef = useRef(0);
  const completedRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const seasonRef = useRef(weeklySeed("sonar"));

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

  const initLevel = (lv: SonarLevel, idx: number) => {
    levelRef.current = lv;
    levelIdxRef.current = idx;
    const { cell, ox, oy } = geom(lv);
    playerRef.current = { x: ox + (lv.start.c + 0.5) * cell, y: oy + (lv.start.r + 0.5) * cell };
    pingsRef.current = [];
    bumpsRef.current = [];
    visitedRef.current = new Set();
    pingCountRef.current = 0;
    levelStartRef.current = performance.now();
    setLevel(lv);
    setLevelIdx(idx);
    setPings(0);
    setElapsed(0);
    setPhaseBoth("playing");
  };

  const startLevel = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(TOTAL_LEVELS - 1, idx));
    if (safeIdx > completedRef.current) return;
    initLevel(genProgressLevel(safeIdx, seasonRef.current), safeIdx);
  };

  const doPing = () => {
    const lv = levelRef.current;
    if (!lv || phaseRef.current !== "playing" || pingCountRef.current >= lv.pingLimit) return;
    chirp(1250, 320, 0.38, "sine", 0.08); // the sonar ping - the game's voice
    pingsRef.current.push({ x: playerRef.current.x, y: playerRef.current.y, t: performance.now() });
    pingCountRef.current += 1;
    setPings(pingCountRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const saved = readWeeklyProgress("sonar");
    completedRef.current = saved;
    setCompleted(saved);
    startLevel(Math.min(saved, TOTAL_LEVELS - 1));
    if (!window.localStorage.getItem("gd:sonar:help:v2")) setShowHelp(true);

    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

    const toGame = (e: PointerEvent) => {
      const v = viewRef.current;
      if (!v) return { x: -9999, y: -9999 };
      return pointToGame(v, canvas, e.clientX, e.clientY, CW);
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
      try {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const lv = levelRef.current;
      if (!lv) return;
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
          const stars = starsForPings(lv, pingCountRef.current);
          setLastPings(pingCountRef.current);
          setLastTime(time);
          setLastStars(stars);
          [523, 659, 784].forEach((f, i) => window.setTimeout(() => blip(f, 0.12, "triangle", 0.07), i * 90));
          const nextCompleted = Math.max(completedRef.current, levelIdxRef.current + 1);
          completedRef.current = nextCompleted;
          setCompleted(nextCompleted);
          writeWeeklyProgress("sonar", nextCompleted);
          void reportLevelProgress("sonar", nextCompleted);
          setPhaseBoth(levelIdxRef.current >= TOTAL_LEVELS - 1 ? "allDone" : "levelDone");
        }

        hudTick++;
        if (hudTick % 20 === 0) {
          setElapsed((now - levelStartRef.current) / 1000);
        }
      }

      // ---- render ----
      viewRef.current = applyView(canvas, ctx, CW, CH, portraitRef.current, "#0b0d14");
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, 0, CW, CH);

      // breadcrumbs
      ctx.fillStyle = `rgba(246,241,231,${lv.trailAlpha})`;
      for (const key of visitedRef.current) {
        const [c, r] = key.split(",").map(Number);
        ctx.fillRect(ox + c * cell + cell * 0.35, oy + r * cell + cell * 0.35, cell * 0.3, cell * 0.3);
      }

      // walls revealed by pings and bumps
      const activePings = pingsRef.current.filter((pg) => (now - pg.t) / 1000 < lv.pingLife);
      pingsRef.current = activePings;
      const activeBumps = bumpsRef.current.filter((b) => (now - b.t) / 1000 < 0.5);
      bumpsRef.current = activeBumps;
      const maxR = lv.pingRadius * cell;
      for (let r = 0; r < lv.rows; r++) {
        for (let c = 0; c < lv.cols; c++) {
          if (lv.grid[r][c] !== 1) continue;
          const wx = ox + (c + 0.5) * cell;
          const wy = oy + (r + 0.5) * cell;
          let alpha = 0;
          for (const pg of activePings) {
            const age = (now - pg.t) / 1000;
            const d = Math.hypot(wx - pg.x, wy - pg.y);
            const ringR = (age / lv.pingLife) * maxR * 1.4;
            if (d < ringR) alpha = Math.max(alpha, (1 - age / lv.pingLife) * Math.max(0, 1 - d / maxR));
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
        const ringR = (age / lv.pingLife) * maxR * 1.4;
        ctx.strokeStyle = `rgba(232,194,104,${(1 - age / lv.pingLife) * 0.5})`;
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
      } catch (err) {
        // one bad frame must never kill the game - log it, skip it, keep drawing
        console.error("SONAR frame error:", err);
      } finally {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", applyOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pingLimit = level?.pingLimit ?? 0;
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
          <span className="lab">Pings</span>
          <span className="val">{pings}/{pingLimit}</span>
        </div>
        <div className="stat">
          <span className="lab">3 stars</span>
          <span className="val">≤{level?.parPings ?? 0}</span>
        </div>
        <div className="stat">
          <span className="lab">Time</span>
          <span className="val">{fmtTime(elapsed)}</span>
        </div>
        <div className="stat">
          <span className="lab">Week</span>
          <span className="val">{weekLabel()}</span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
        <button
          onClick={doPing}
          disabled={phase !== "playing" || pings >= pingLimit}
          className="btn-ink absolute bottom-3 right-3 w-14 h-14 rounded-full text-xs disabled:opacity-40"
          aria-label="Ping"
        >
          PING
        </button>
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

      <p className="hint">
        hold &amp; drag to move<span className="hidden sm:inline"> (or WASD/arrows)</span> · ping
        <span className="hidden sm:inline"> (space)</span> to reveal walls · 3 stars at{" "}
        {level?.parPings ?? 0} pings or fewer ·{" "}
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
                  window.localStorage.setItem("gd:sonar:help:v2", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. You&apos;re in a pitch-black maze.</span>{" "}
                Only the golden exit glows in the distance.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Hold &amp; drag to move</span> toward
                your finger (or use WASD / arrow keys).
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Ping to see.</span> The wave reveals
                nearby walls, then fades. Later levels reveal less area for less time and leave
                fainter breadcrumbs.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Pings are limited.</span> On this level,
                use {level?.parPings ?? 0} or fewer for 3 stars, {level?.twoStarPings ?? 0} or fewer
                for 2 stars, or up to {pingLimit} for 1 star. After the last ping you can still move
                and escape.
              </li>
              <li>
                <span className="tx-ink font-semibold">5. Keep climbing.</span> Routes
                grow from 10 to 136 steps. Every Monday brings a globally shared maze remix;
                weekly depth is ranked and your career best remains saved.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:sonar:help:v2", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - into the dark
            </button>
            <GuideLink game="sonar" />
          </div>
        </div>
      )}

      {phase === "levelDone" && (
        <Celebration
          title={`Level ${levelIdx + 1} escaped!`}
          share={{ game: "sonar", level: levelIdx + 1 }}
          stars={lastStars}
          score={{ label: "pings used", value: lastPings }}
          badges={[
            fmtTime(lastTime),
            `${completed} completed this week`,
          ]}
          primary={{ label: `Level ${levelIdx + 2} →`, onClick: () => startLevel(levelIdx + 1) }}
          secondary={{ label: "Replay level", onClick: () => startLevel(levelIdx) }}
          footnote={`Stars: 3 at ≤${level?.parPings ?? 0}, 2 at ≤${level?.twoStarPings ?? 0}, 1 at ≤${pingLimit} pings.`}
        />
      )}

      {phase === "allDone" && (
        <Celebration
          title="Weekly SONAR run complete!"
          stars={lastStars}
          score={{ label: "levels completed", value: TOTAL_LEVELS }}
          badges={[`${lastPings} pings on the final challenge`, "Weekly run complete"]}
          primary={{ label: "Replay final level", onClick: () => startLevel(TOTAL_LEVELS - 1) }}
          secondary={{ label: "Back to Level 1", onClick: () => startLevel(0) }}
          feedback="sonar"
          finalWeek
        />
      )}
    </div>
  );
}
