"use client";

import { useEffect, useRef, useState } from "react";
import { CH, CW, Stroke, genTargets, similarity } from "./engine";
import { dayNumber, todayKey } from "@/lib/sdk/daily";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { buildShare, shareResult } from "@/lib/sdk/share";
import Countdown from "@/components/Countdown";

const MEMORIZE_S = 3;
const PEEK_S = 1.2;
const PEEK_COST = 8;

type Phase = "memorize" | "draw" | "peek" | "scored" | "dayDone";

export default function TraceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("memorize");
  const [scores, setScores] = useState<number[]>([]);
  const [hasInk, setHasInk] = useState(false);
  const [peeked, setPeeked] = useState(false);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const targetsRef = useRef<Stroke[][]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  const curStrokeRef = useRef<Stroke | null>(null);
  const phaseRef = useRef<Phase>("memorize");
  const roundRef = useRef(0);
  const phaseStartRef = useRef(0);
  const peekedRef = useRef(false);
  const scoresRef = useRef<number[]>([]);
  const dayRef = useRef("");

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    phaseStartRef.current = performance.now();
    setPhase(p);
  };

  const startRound = (idx: number) => {
    roundRef.current = idx;
    strokesRef.current = [];
    curStrokeRef.current = null;
    peekedRef.current = false;
    setPeeked(false);
    setHasInk(false);
    setRound(idx);
    setPhaseBoth("memorize");
  };

  const submit = () => {
    if (phaseRef.current !== "draw" || strokesRef.current.length === 0) return;
    const target = targetsRef.current[roundRef.current];
    let s = similarity(target, strokesRef.current);
    if (peekedRef.current) s = Math.max(0, Math.round((s - PEEK_COST) * 10) / 10);
    scoresRef.current = [...scoresRef.current];
    scoresRef.current[roundRef.current] = s;
    setScores([...scoresRef.current]);
    if (roundRef.current >= 2) {
      const avg = Math.round((scoresRef.current.reduce((a, b) => a + b, 0) / 3) * 10) / 10;
      saveResult("trace", dayRef.current, { score: avg, won: true }, true);
      setStreak(getStreak("trace", dayRef.current));
      setPhaseBoth("scored");
    } else {
      setPhaseBoth("scored");
    }
  };

  const peek = () => {
    if (phaseRef.current !== "draw" || peekedRef.current) return;
    peekedRef.current = true;
    setPeeked(true);
    setPhaseBoth("peek");
  };

  const clearInk = () => {
    if (phaseRef.current !== "draw") return;
    strokesRef.current = [];
    curStrokeRef.current = null;
    setHasInk(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(dayNumber());
    setStreak(getStreak("trace", dayRef.current));
    targetsRef.current = genTargets(dayRef.current);
    startRound(0);
    if (!window.localStorage.getItem("gd:trace:help")) setShowHelp(true);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;

    const toGame = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * CW, y: ((e.clientY - rect.top) / rect.height) * CH };
    };
    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "draw") return;
      canvas.setPointerCapture(e.pointerId);
      curStrokeRef.current = [toGame(e)];
      strokesRef.current.push(curStrokeRef.current);
      setHasInk(true);
    };
    const onMove = (e: PointerEvent) => {
      const cur = curStrokeRef.current;
      if (!cur || phaseRef.current !== "draw") return;
      const p = toGame(e);
      const lastP = cur[cur.length - 1];
      if (Math.hypot(p.x - lastP.x, p.y - lastP.y) > 3) cur.push(p);
    };
    const onUp = () => {
      curStrokeRef.current = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);

    let raf = 0;

    const drawStrokes = (strokes: Stroke[], color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const st of strokes) {
        if (st.length < 2) {
          if (st.length === 1) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(st[0].x, st[0].y, width / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(st[0].x, st[0].y);
        for (const p of st) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };

    const draw = (now: number) => {
      const target = targetsRef.current[roundRef.current] || [];
      const phaseAge = (now - phaseStartRef.current) / 1000;

      if (phaseRef.current === "memorize" && phaseAge >= MEMORIZE_S) setPhaseBoth("draw");
      if (phaseRef.current === "peek" && phaseAge >= PEEK_S) setPhaseBoth("draw");

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#f9f5ec";
      ctx.fillRect(0, 0, CW, CH);

      // faint paper grid
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
        phaseRef.current === "memorize" || phaseRef.current === "peek" || phaseRef.current === "scored" || phaseRef.current === "dayDone";
      if (showTarget) drawStrokes(target, "rgba(41,36,32,0.9)", 6);
      drawStrokes(strokesRef.current, "rgba(180,83,9,0.85)", 5);

      if (phaseRef.current === "memorize") {
        const remain = Math.ceil(MEMORIZE_S - phaseAge);
        ctx.fillStyle = "rgba(41,36,32,0.8)";
        ctx.font = "bold 46px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(remain), CW - 60, 70);
        ctx.font = "600 15px ui-sans-serif, system-ui";
        ctx.fillText("memorize it", CW - 60, 96);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avg = scores.length === 3 ? Math.round((scores.reduce((a, b) => a + b, 0) / 3) * 10) / 10 : 0;
  const prior = typeof window !== "undefined" && dayRef.current ? loadResult("trace", dayRef.current) : null;

  const share = async () => {
    // one dot per sketch: green = sharp memory, yellow = fuzzy, red = abstract art
    const dot = (s: number) => (s >= 75 ? "🟢" : s >= 50 ? "🟡" : "🔴");
    const text = buildShare("TRACE", num, [
      scores.map((s) => `${dot(s)}${s}%`).join(" "),
      `✏️ ${avg}% from memory`,
    ]);
    const outcome = await shareResult(text);
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const restartDay = () => {
    scoresRef.current = [];
    setScores([]);
    startRound(0);
  };

  return (
    <div className="relative w-full">
      <div className="stat-bar">
        <div className="stat">
          <span className="lab">Sketch</span>
          <span className="val">{round + 1}/3</span>
        </div>
        {[0, 1, 2].map((i) => (
          <div className="stat" key={i}>
            <span className="lab">#{i + 1}</span>
            <span className={`val${scores[i] === undefined ? " text-stone-400" : ""}`}>
              {scores[i] === undefined ? "—" : `${scores[i]}%`}
            </span>
          </div>
        ))}
        <div className="stat">
          <span className="lab">Streak</span>
          <span className="val">{streak}🔥</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="board cursor-crosshair" style={{ aspectRatio: `${CW}/${CH}` }} />

      <div className="mt-3 flex items-center justify-center gap-2">
        <button onClick={clearInk} disabled={phase !== "draw" || !hasInk} className="btn-line px-4 py-2 disabled:opacity-40">
          Clear
        </button>
        <button onClick={peek} disabled={phase !== "draw" || peeked} className="btn-line px-4 py-2 disabled:opacity-40">
          Peek −{PEEK_COST}%
        </button>
        <button onClick={submit} disabled={phase !== "draw" || !hasInk} className="btn-ink px-7 py-2 disabled:opacity-40">
          Done ✏️
        </button>
      </div>
      <p className="hint">
        memorize for 3s · redraw in place · <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {showHelp && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4 text-center">How to play</h2>
            <ol className="space-y-3 text-stone-600 text-sm leading-relaxed">
              <li>
                <span className="text-stone-900 font-semibold">1. A drawing appears for 3 seconds.</span>{" "}
                Burn it into your memory.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">2. It vanishes — now redraw it</span> in
                the same place, same size, freehand.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">3. Press Done</span> to see the original
                over your attempt and get your accuracy score. One Peek per sketch costs {PEEK_COST}%.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">4. Three sketches a day,</span> harder
                each time. Your day score is the average.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:trace:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it — sharpen the pencil
            </button>
          </div>
        </div>
      )}

      {phase === "scored" && round < 2 && (
        <div className="scrim fixed inset-0 flex items-end justify-center z-50 p-4 pb-10">
          <div className="panel text-center max-w-sm">
            <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
              {scores[round] >= 75 ? "Photographic! " : scores[round] >= 50 ? "Not bad — " : "Rough — "}
              {scores[round]}%
            </h2>
            <p className="text-xs text-stone-500 mb-3">ink = original · amber = you</p>
            <button onClick={() => startRound(round + 1)} className="btn-ink px-6 py-2">
              Sketch {round + 2} — harder →
            </button>
          </div>
        </div>
      )}

      {phase === "scored" && round >= 2 && (
        <div className="scrim fixed inset-0 flex items-end justify-center z-50 p-4 pb-10">
          <div className="panel text-center max-w-sm">
            <h2 className="font-serif text-xl font-bold text-stone-900 mb-1">
              TRACE #{num}: {avg}% from memory
            </h2>
            <p className="text-xs text-stone-500 mb-3">
              {scores.map((s) => `${s}%`).join(" · ")}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={share} className="btn-ink px-5 py-2">
                {copied ? "Shared ✓" : "Share result"}
              </button>
              <button onClick={restartDay} className="btn-line px-5 py-2">
                Beat it
              </button>
            </div>
            {prior?.won && <p className="text-xs text-stone-400 mt-3">Today&apos;s best: {prior.score}%</p>}
            <p className="text-xs text-stone-400 mt-2">
              <Countdown prefix="New sketches in" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
