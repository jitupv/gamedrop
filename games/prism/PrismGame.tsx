"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";

import {
  Cell,
  MirrorType,
  PrismLevel,
  TOTAL_LEVELS,
  TraceResult,
  genProgressLevel,
  isPlaceable,
  isSolved,
  levelCfg,
  starsFor,
  traceBeam,
} from "./engine";
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
const BG = "#12151b";
const ACCENT = "#ff2d6f";

type Phase = "play" | "levelClear" | "allDone";

export default function PrismGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("play");
  const [levelIdx, setLevelIdx] = useState(0);
  const [mirrorsUsed, setMirrorsUsed] = useState(0);
  const [targetsHit, setTargetsHit] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [lastStars, setLastStars] = useState(1);
  const [lastDistance, setLastDistance] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const levelRef = useRef<PrismLevel | null>(null);
  const mirrorsRef = useRef<Map<string, MirrorType>>(new Map());
  const traceRef = useRef<TraceResult | null>(null);
  const phaseRef = useRef<Phase>("play");
  const levelIdxRef = useRef(0);
  const completedRef = useRef(0);
  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const seasonRef = useRef(weeklySeed("prism"));

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const geom = (level: PrismLevel) => {
    const cell = Math.min(
      Math.floor((CW - 24) / level.cols),
      Math.floor((CH - 24) / level.rows)
    );
    return {
      cell,
      ox: (CW - cell * level.cols) / 2,
      oy: (CH - cell * level.rows) / 2,
    };
  };

  const loadLevel = (index: number) => {
    const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, index));
    const level = genProgressLevel(safeIndex, seasonRef.current);
    levelRef.current = level;
    levelIdxRef.current = safeIndex;
    mirrorsRef.current = new Map();
    const trace = traceBeam(level, mirrorsRef.current);
    traceRef.current = trace;
    setLevelIdx(safeIndex);
    setMirrorsUsed(0);
    setTargetsHit(trace.hitTargets.size);
    setPhaseBoth("play");
  };

  const finishLevel = (used: number, distance: number) => {
    const level = levelRef.current;
    if (!level || phaseRef.current !== "play") return;

    chirp(420, 880, 0.32, "triangle", 0.07);
    setLastStars(starsFor(used, distance, level.par, level.parDistance));
    setLastDistance(distance);

    const finished = levelIdxRef.current + 1;
    const nextCompleted = Math.max(completedRef.current, finished);
    if (nextCompleted > completedRef.current) {
      completedRef.current = nextCompleted;
      setCompleted(nextCompleted);
      writeWeeklyProgress("prism", nextCompleted);
      reportLevelProgress("prism", nextCompleted);
    }

    setPhaseBoth(finished === TOTAL_LEVELS ? "allDone" : "levelClear");
  };

  const syncMirrorState = () => {
    const level = levelRef.current;
    if (!level) return;
    const used = mirrorsRef.current.size;
    setMirrorsUsed(used);
    const trace = traceBeam(level, mirrorsRef.current);
    traceRef.current = trace;
    setTargetsHit(trace.hitTargets.size);
    if (isSolved(level, trace)) finishLevel(used, trace.path.length - 1);
  };

  const resetMirrors = () => {
    if (phaseRef.current !== "play") return;
    loadLevel(levelIdxRef.current);
    blip(260, 0.05, "sine", 0.035);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const saved = readWeeklyProgress("prism");
    completedRef.current = saved;
    setCompleted(saved);
    loadLevel(Math.min(saved, TOTAL_LEVELS - 1));

    if (!window.localStorage.getItem("gd:prism:help:v6")) setShowHelp(true);

    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

    const cellFromEvent = (event: PointerEvent): Cell | null => {
      const level = levelRef.current;
      const view = viewRef.current;
      if (!level || !view) return null;
      const { cell, ox, oy } = geom(level);
      const { x, y } = pointToGame(view, canvas, event.clientX, event.clientY, CW);
      const c = Math.floor((x - ox) / cell);
      const r = Math.floor((y - oy) / cell);
      if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return null;
      return { c, r };
    };

    const onDown = (event: PointerEvent) => {
      if (phaseRef.current !== "play") return;
      const level = levelRef.current;
      const hit = cellFromEvent(event);
      if (!level || !hit) return;
      if (!isPlaceable(level, hit.c, hit.r)) {
        blip(220, 0.06, "square", 0.04);
        return;
      }

      const key = `${hit.c},${hit.r}`;
      const existing = mirrorsRef.current.get(key);
      if (existing === undefined) {
        mirrorsRef.current.set(key, "/");
        blip(520, 0.05, "triangle", 0.04);
      } else if (existing === "/") {
        mirrorsRef.current.set(key, "\\");
        blip(560, 0.05, "triangle", 0.04);
      } else {
        mirrorsRef.current.delete(key);
        blip(300, 0.05, "sine", 0.035);
      }
      syncMirrorState();
    };
    canvas.addEventListener("pointerdown", onDown);

    let raf = 0;
    const draw = () => {
      const level = levelRef.current;
      const view = applyView(canvas, ctx, CW, CH, portraitRef.current, BG);
      viewRef.current = view;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, CW, CH);

      if (!level || !traceRef.current) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const { cell, ox, oy } = geom(level);
      const trace = traceRef.current;
      const solved = isSolved(level, trace);

      ctx.strokeStyle = "rgba(238,240,245,0.06)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= level.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(ox + c * cell, oy);
        ctx.lineTo(ox + c * cell, oy + level.rows * cell);
        ctx.stroke();
      }
      for (let r = 0; r <= level.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + r * cell);
        ctx.lineTo(ox + level.cols * cell, oy + r * cell);
        ctx.stroke();
      }

      for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
          if (!level.walls[r][c]) continue;
          ctx.fillStyle = "rgba(238,240,245,0.09)";
          ctx.beginPath();
          ctx.roundRect(
            ox + c * cell + 3,
            oy + r * cell + 3,
            cell - 6,
            cell - 6,
            6
          );
          ctx.fill();
        }
      }

      level.targets.forEach((target, index) => {
        const x = ox + (target.c + 0.5) * cell;
        const y = oy + (target.r + 0.5) * cell;
        const hit = trace.hitTargets.has(index);
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.22, 0, Math.PI * 2);
        if (hit) {
          ctx.fillStyle = ACCENT + "30";
          ctx.fill();
        }
        ctx.strokeStyle = hit ? ACCENT : "rgba(238,240,245,0.32)";
        ctx.lineWidth = hit ? 3 : 2;
        ctx.stroke();
      });

      {
        const x = ox + (level.receiver.c + 0.5) * cell;
        const y = oy + (level.receiver.r + 0.5) * cell;
        const size = cell * 0.32;
        const color = solved ? "#3fbf7f" : ACCENT;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fillStyle = solved ? "rgba(63,191,127,0.35)" : color + "1f";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      {
        const x = ox + (level.emitter.cell.c + 0.5) * cell;
        const y = oy + (level.emitter.cell.r + 0.5) * cell;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.17, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
      }

      for (const [key, type] of mirrorsRef.current) {
        const [c, r] = key.split(",").map(Number);
        const x = ox + (c + 0.5) * cell;
        const y = oy + (r + 0.5) * cell;
        const size = cell * 0.34;
        ctx.strokeStyle = "#eef0f5";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (type === "/") {
          ctx.moveTo(x - size, y + size);
          ctx.lineTo(x + size, y - size);
        } else {
          ctx.moveTo(x - size, y - size);
          ctx.lineTo(x + size, y + size);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = solved ? "#ffe08a" : ACCENT;
      ctx.lineWidth = solved ? 5 : 3.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = solved ? "#ffe08a" : ACCENT;
      ctx.shadowBlur = solved ? 20 : 9;
      ctx.beginPath();
      trace.path.forEach((point, index) => {
        const x = ox + (point.c + 0.5) * cell;
        const y = oy + (point.r + 0.5) * cell;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", applyOrientation);
      canvas.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = levelCfg(levelIdx);
  const minimumMirrors = levelRef.current?.par ?? cfg.routeMirrors;
  const minimumDistance = levelRef.current?.parDistance ?? 0;
  const maxUnlockedIndex = Math.min(completed, TOTAL_LEVELS - 1);
  const ruleSummary = [
    `${levelRef.current?.verifiedRoutes ?? 3}+ solution paths`,
    "targets in any order",
    (levelRef.current?.noCrossing ?? cfg.noCrossing) ? "no crossing" : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
          <span className="lab">Mirrors</span>
          <span className="val">{mirrorsUsed}</span>
        </div>
        <div className="stat">
          <span className="lab">Targets</span>
          <span className="val">
            {targetsHit}/{cfg.targets}
          </span>
        </div>
        <div className="stat">
          <span className="lab">3 stars</span>
          <span className="val">{minimumMirrors} / {minimumDistance}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
      </div>

      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button
          onClick={() => loadLevel(levelIdx - 1)}
          disabled={levelIdx === 0 || phase !== "play"}
          className="btn-line px-4 py-2 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          onClick={resetMirrors}
          disabled={phase !== "play"}
          className="btn-line px-4 py-2 disabled:opacity-40"
        >
          Reset
        </button>
        <button
          onClick={() => loadLevel(levelIdx + 1)}
          disabled={
            phase !== "play" ||
            levelIdx >= maxUnlockedIndex ||
            levelIdx >= TOTAL_LEVELS - 1
          }
          className="btn-line px-4 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <p className="hint">
        beam stays live · <b>no mirror limit</b> ·{" "}
        <span className="hidden sm:inline">
          3★ {minimumMirrors} mirrors / {minimumDistance} cells · 2★ up to {minimumMirrors + 1} mirrors ·{" "}
        </span>
        {ruleSummary && <><b>{ruleSummary}</b> · </>}
        <span className="hidden sm:inline">{weekLabel()} · </span>
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
                  window.localStorage.setItem("gd:prism:help:v6", "1");
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
                <span className="tx-ink font-semibold">1. Bend the laser.</span>{" "}
                Tap a cell to place a mirror, tap again to flip it, and a third
                time to remove it.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Hit every target.</span>{" "}
                The beam must pass through every ring, in any order, before reaching the receiver.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Stars reward efficiency.</span>{" "}
                Use both the minimum mirrors and shortest verified beam distance for 3 stars.
                A longer minimum-mirror route or one extra mirror earns 2 stars. Any other
                completed route earns 1 star.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Find your own route.</span>{" "}
                Every level has at least three complete paths. There are no fixed mirrors,
                no forced target order, and no mirror placement limit. From Level 3 the beam
                cannot cross its own path.
              </li>
              <li>
                <span className="tx-ink font-semibold">5. Keep climbing.</span>{" "}
                Every Monday brings a globally shared remix. Weekly progress starts
                at Level 1 while your career best remains saved.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:prism:help:v6", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Start playing
            </button>
            <GuideLink game="prism" />
          </div>
        </div>
      )}

      {phase === "levelClear" && (
        <Celebration
          title={`Level ${levelIdx + 1} complete!`}
          share={{ game: "prism", level: levelIdx + 1 }}
          stars={lastStars}
          score={{ label: "mirrors used", value: mirrorsUsed }}
          badges={[
            `${completed} completed this week`,
            `${lastDistance} beam cells`,
            `3-star goal: ${minimumMirrors} mirrors / ${minimumDistance} cells`,
          ]}
          primary={{
            label: `Level ${levelIdx + 2} →`,
            onClick: () => loadLevel(levelIdx + 1),
          }}
          secondary={{
            label: "Replay",
            onClick: () => loadLevel(levelIdx),
          }}
          footnote="Weekly progress saved. The next level increases the challenge."
        />
      )}

      {phase === "allDone" && (
        <Celebration
          title="Weekly PRISM run complete!"
          stars={3}
          score={{ label: "levels completed", value: completed }}
          badges={["PRISM mastered 🏆"]}
          primary={{
            label: "Replay final level",
            onClick: () => loadLevel(TOTAL_LEVELS - 1),
          }}
          secondary={{
            label: "Back to level 1",
            onClick: () => loadLevel(0),
          }}
          feedback="prism"
          finalWeek
        />
      )}
    </div>
  );
}
