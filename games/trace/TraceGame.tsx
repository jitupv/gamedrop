"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";
import {
  CH,
  CW,
  Stroke,
  TOTAL_LEVELS,
  TraceLevel,
  genProgressLevel,
  similarity,
  starsForAccuracy,
} from "./engine";
import Celebration from "@/components/Celebration";
import GuideLink from "@/components/GuideLink";
import { reportLevelProgress } from "@/lib/sdk/leaderboard";
import { blip, chirp } from "@/lib/sdk/sound";
import { View, applyView, inScreenSpace, pointToGame } from "@/lib/sdk/viewport";
import {
  readWeeklyProgress,
  weekLabel,
  weeklySeed,
  writeWeeklyProgress,
} from "@/lib/sdk/weekly";

type Phase = "memorize" | "draw" | "peek" | "levelDone" | "failed" | "allDone";

export default function TraceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState<TraceLevel | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("memorize");
  const [completed, setCompleted] = useState(0);
  const [hasInk, setHasInk] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [lastAccuracy, setLastAccuracy] = useState(0);
  const [lastStars, setLastStars] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const levelRef = useRef<TraceLevel | null>(null);
  const levelIdxRef = useRef(0);
  const completedRef = useRef(0);
  const phaseRef = useRef<Phase>("memorize");
  const phaseStartRef = useRef(0);
  const peekedRef = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const curStrokeRef = useRef<Stroke | null>(null);
  const seasonRef = useRef(weeklySeed("trace"));

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    phaseStartRef.current = performance.now();
    setPhase(next);
  };

  const startLevel = (idx: number) => {
    const safeIdx = Math.max(0, Math.min(TOTAL_LEVELS - 1, idx));
    if (safeIdx > completedRef.current) return;
    const next = genProgressLevel(safeIdx, seasonRef.current);
    levelRef.current = next;
    levelIdxRef.current = safeIdx;
    strokesRef.current = [];
    curStrokeRef.current = null;
    peekedRef.current = false;
    setLevel(next);
    setLevelIdx(safeIdx);
    setHasInk(false);
    setPeeked(false);
    setLastAccuracy(0);
    setLastStars(0);
    setPhaseBoth("memorize");
  };

  const clearInk = () => {
    if (phaseRef.current !== "draw") return;
    strokesRef.current = [];
    curStrokeRef.current = null;
    setHasInk(false);
  };

  const peek = () => {
    if (phaseRef.current !== "draw" || peekedRef.current) return;
    peekedRef.current = true;
    setPeeked(true);
    setPhaseBoth("peek");
  };

  const submit = () => {
    const current = levelRef.current;
    if (!current || phaseRef.current !== "draw" || strokesRef.current.length === 0) return;

    let accuracy = similarity(current.target, strokesRef.current);
    if (peekedRef.current) {
      accuracy = Math.max(0, Math.round((accuracy - current.peekCost) * 10) / 10);
    }
    const stars = starsForAccuracy(current, accuracy);
    setLastAccuracy(accuracy);
    setLastStars(stars);
    blip(600, 0.07, "triangle", 0.05);

    if (stars === 0) {
      chirp(400, 170, 0.32, "sawtooth", 0.06);
      setPhaseBoth("failed");
      return;
    }

    const nextCompleted = Math.max(completedRef.current, levelIdxRef.current + 1);
    completedRef.current = nextCompleted;
    setCompleted(nextCompleted);
    writeWeeklyProgress("trace", nextCompleted);
    reportLevelProgress("trace", nextCompleted);
    setPhaseBoth(levelIdxRef.current >= TOTAL_LEVELS - 1 ? "allDone" : "levelDone");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const saved = readWeeklyProgress("trace");
    completedRef.current = saved;
    setCompleted(saved);
    startLevel(Math.min(saved, TOTAL_LEVELS - 1));
    if (!window.localStorage.getItem("gd:trace:help:v2")) setShowHelp(true);

    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

    const toGame = (e: PointerEvent) => {
      const view = viewRef.current;
      if (!view) return { x: -9999, y: -9999 };
      return pointToGame(view, canvas, e.clientX, e.clientY, CW);
    };
    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "draw") return;
      canvas.setPointerCapture(e.pointerId);
      curStrokeRef.current = [toGame(e)];
      strokesRef.current.push(curStrokeRef.current);
      setHasInk(true);
    };
    const onMove = (e: PointerEvent) => {
      const stroke = curStrokeRef.current;
      if (!stroke || phaseRef.current !== "draw") return;
      const point = toGame(e);
      const last = stroke[stroke.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) > 3) stroke.push(point);
    };
    const onUp = () => {
      curStrokeRef.current = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const drawStrokes = (strokes: Stroke[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const stroke of strokes) {
        if (stroke.length === 1) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (const point of stroke) ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    };

    let raf = 0;
    const draw = (now: number) => {
      const current = levelRef.current;
      if (!current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const age = (now - phaseStartRef.current) / 1000;
      if (phaseRef.current === "memorize" && age >= current.memorizeSeconds) {
        setPhaseBoth("draw");
      }
      if (phaseRef.current === "peek" && age >= current.peekSeconds) {
        setPhaseBoth("draw");
      }

      const view = applyView(canvas, ctx, CW, CH, portraitRef.current, "#f9f5ec");
      viewRef.current = view;
      ctx.fillStyle = "#f9f5ec";
      ctx.fillRect(0, 0, CW, CH);

      ctx.strokeStyle = "rgba(41,36,32,0.045)";
      ctx.lineWidth = 1;
      for (let x = 60; x < CW; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CH);
        ctx.stroke();
      }
      for (let y = 60; y < CH; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CW, y);
        ctx.stroke();
      }

      const showTarget =
        phaseRef.current === "memorize" ||
        phaseRef.current === "peek" ||
        phaseRef.current === "levelDone" ||
        phaseRef.current === "failed" ||
        phaseRef.current === "allDone";
      if (showTarget) drawStrokes(current.target, "rgba(41,36,32,0.9)", 6);
      drawStrokes(strokesRef.current, "rgba(180,83,9,0.85)", 5);

      if (phaseRef.current === "memorize") {
        const remain = Math.max(1, Math.ceil(current.memorizeSeconds - age));
        inScreenSpace(ctx, view, (width) => {
          ctx.fillStyle = "rgba(41,36,32,0.8)";
          ctx.textAlign = "center";
          ctx.font = "bold 46px ui-sans-serif, system-ui";
          ctx.fillText(String(remain), width - 56, 66);
          ctx.font = "600 15px ui-sans-serif, system-ui";
          ctx.fillText("memorize", width - 56, 92);
        });
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", applyOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <span className="lab">Pass</span>
          <span className="val">{level?.passAccuracy ?? 35}%</span>
        </div>
        <div className="stat">
          <span className="lab">2 stars</span>
          <span className="val">{level?.twoStarAccuracy ?? 55}%</span>
        </div>
        <div className="stat">
          <span className="lab">3 stars</span>
          <span className="val">{level?.threeStarAccuracy ?? 75}%</span>
        </div>
        <div className="stat">
          <span className="lab">Week</span>
          <span className="val">{weekLabel()}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board cursor-crosshair" />
      </div>

      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button
          onClick={() => startLevel(levelIdx - 1)}
          disabled={levelIdx === 0}
          className="btn-line px-3 py-2 disabled:opacity-40"
        >
          Prev
        </button>
        <button
          onClick={clearInk}
          disabled={phase !== "draw" || !hasInk}
          className="btn-line px-3 py-2 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          onClick={peek}
          disabled={phase !== "draw" || peeked}
          className="btn-line px-3 py-2 disabled:opacity-40"
        >
          Peek -{level?.peekCost ?? 8}%
        </button>
        <button
          onClick={submit}
          disabled={phase !== "draw" || !hasInk}
          className="btn-ink px-5 py-2 disabled:opacity-40"
        >
          Done
        </button>
        <button
          onClick={() => startLevel(levelIdx + 1)}
          disabled={!nextUnlocked}
          className="btn-line px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <p className="hint">
        memorize for {level?.memorizeSeconds ?? 4.5}s - redraw in the same place -{" "}
        <button onClick={() => startLevel(levelIdx)}>restart level</button> -{" "}
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
                  window.localStorage.setItem("gd:trace:help:v2", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. Memorize the black drawing.</span>{" "}
                It disappears when the timer ends.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Redraw it from memory</span> in the
                same place and at the same size. Use separate strokes when the target has them.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Press Done for an accuracy score.</span>{" "}
                Earn 3 stars at 75%, 2 at 55%, or 1 star and pass at 35%. Below 35% must be retried.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Peek once if you need it.</span>{" "}
                The target briefly returns, but 8% is deducted from your accuracy.
              </li>
              <li>
                <span className="tx-ink font-semibold">5. Keep climbing.</span>{" "}
                The drawings gain more strokes and harder shapes while memorization time shrinks.
                Every Monday changes the shapes and positions. Weekly depth is ranked,
                while your career best remains saved.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:trace:help:v2", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - start drawing
            </button>
            <GuideLink game="trace" />
          </div>
        </div>
      )}

      {phase === "failed" && (
        <Celebration
          title={`Level ${levelIdx + 1} needs another try`}
          stars={0}
          score={{ label: "accuracy", value: lastAccuracy, decimals: 1, suffix: "%" }}
          badges={[`Pass at ${level?.passAccuracy ?? 35}%`]}
          primary={{ label: "Retry level", onClick: () => startLevel(levelIdx) }}
          secondary={levelIdx > 0 ? { label: "Previous level", onClick: () => startLevel(levelIdx - 1) } : undefined}
          footnote="Black is the target; amber is your attempt. Match position, size, and every stroke."
        />
      )}

      {phase === "levelDone" && (
        <Celebration
          title={`Level ${levelIdx + 1} traced!`}
          stars={lastStars}
          score={{ label: "accuracy", value: lastAccuracy, decimals: 1, suffix: "%" }}
          badges={[`${completed} completed this week`, peeked ? "Peek used: -8%" : "No peek"]}
          primary={{ label: `Level ${levelIdx + 2} ->`, onClick: () => startLevel(levelIdx + 1) }}
          secondary={{ label: "Replay level", onClick: () => startLevel(levelIdx) }}
          footnote="Stars: 3 at 75%, 2 at 55%, 1 at 35%. Below 35% does not unlock the next level."
        />
      )}

      {phase === "allDone" && (
        <Celebration
          title="Weekly TRACE run complete!"
          stars={lastStars}
          score={{ label: "levels completed", value: TOTAL_LEVELS }}
          badges={[`${lastAccuracy}% on the final challenge`, "Weekly run complete"]}
          primary={{ label: "Replay final level", onClick: () => startLevel(TOTAL_LEVELS - 1) }}
          secondary={{ label: "Back to Level 1", onClick: () => startLevel(0) }}
          feedback="trace"
          finalWeek
        />
      )}
    </div>
  );
}
