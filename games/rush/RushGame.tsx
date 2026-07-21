"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEL,
  AXIS_LEN,
  CAR_LEN,
  CH,
  CRUISE,
  CW,
  Car,
  DAILY_GOAL,
  GAP,
  HALF,
  LANE,
  STOP,
  XC,
  YC,
  carRect,
  isHorizontal,
  makeSpawner,
  rectsOverlap,
  spawnInterval,
} from "./engine";
import { dayNumber, todayKey } from "@/lib/sdk/daily";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { buildShare, shareResult } from "@/lib/sdk/share";
import Countdown from "@/components/Countdown";

const COLORS = ["#c96f4a", "#d9a441", "#8a9a5b", "#6f8fa8", "#9d7a94", "#b25d6d"];

type Phase = "ready" | "run" | "crashed";

export default function RushGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const carsRef = useRef<Car[]>([]);
  const lightRef = useRef<"H" | "V">("H");
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const startRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const spawnerRef = useRef<ReturnType<typeof makeSpawner> | null>(null);
  const crashPairRef = useRef<Car[]>([]);
  const shakeRef = useRef(0);
  const dayRef = useRef("");

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const startRun = () => {
    carsRef.current = [];
    lightRef.current = "H";
    scoreRef.current = 0;
    setScore(0);
    spawnerRef.current = makeSpawner(dayRef.current);
    startRef.current = performance.now();
    lastSpawnRef.current = performance.now();
    crashPairRef.current = [];
    setPhaseBoth("run");
  };

  const tap = () => {
    if (phaseRef.current === "ready") {
      startRun();
      return;
    }
    if (phaseRef.current === "run") {
      lightRef.current = lightRef.current === "H" ? "V" : "H";
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(dayNumber());
    setStreak(getStreak("rush", dayRef.current));
    const prior = loadResult("rush", dayRef.current);
    if (prior) {
      bestRef.current = prior.score;
      setBest(prior.score);
    }
    if (!window.localStorage.getItem("gd:rush:help")) setShowHelp(true);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CW * dpr;
    canvas.height = CH * dpr;

    const onDown = () => tap();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        tap();
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);

    let raf = 0;
    let last = performance.now();

    const endRun = () => {
      const s = scoreRef.current;
      saveResult("rush", dayRef.current, { score: s, won: s >= DAILY_GOAL }, true);
      if (s > bestRef.current) {
        bestRef.current = s;
        setBest(s);
      }
      setStreak(getStreak("rush", dayRef.current));
      setPhaseBoth("crashed");
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // ---- simulate ----
      if (phaseRef.current === "run") {
        const spawner = spawnerRef.current;
        const elapsed = (now - startRef.current) / 1000;
        if (spawner && (now - lastSpawnRef.current) / 1000 > spawnInterval(elapsed) * spawner.jitter()) {
          const dir = spawner.nextDir();
          const clear = carsRef.current.every((c) => c.dir !== dir || c.pos > CAR_LEN + GAP + 8);
          if (clear) {
            carsRef.current.push({ dir, pos: 0, v: CRUISE * 0.6, color: spawner.nextColor(), counted: false });
            lastSpawnRef.current = now;
          }
        }

        const light = lightRef.current;
        for (const dir of [0, 1, 2, 3] as const) {
          const group = carsRef.current.filter((c) => c.dir === dir).sort((a, b) => b.pos - a.pos);
          const green = isHorizontal(dir) ? light === "H" : light === "V";
          for (let i = 0; i < group.length; i++) {
            const car = group[i];
            let limit = Infinity;
            if (!green && car.pos <= STOP[dir] + 2) limit = STOP[dir];
            if (i > 0) limit = Math.min(limit, group[i - 1].pos - CAR_LEN - GAP);
            const room = limit - car.pos;
            if (room > 1) {
              car.v = Math.min(CRUISE, car.v + ACCEL * dt);
              car.pos = Math.min(limit, car.pos + car.v * dt);
            } else {
              car.v = 0;
            }
            if (!car.counted && car.pos - CAR_LEN > (isHorizontal(dir) ? XC + HALF : YC + HALF)) {
              car.counted = true;
              scoreRef.current += 1;
              setScore(scoreRef.current);
            }
          }
        }
        carsRef.current = carsRef.current.filter((c) => c.pos - CAR_LEN < AXIS_LEN[c.dir] + 20);

        // crash: any horizontal car overlapping any vertical car
        const hCars = carsRef.current.filter((c) => isHorizontal(c.dir));
        const vCars = carsRef.current.filter((c) => !isHorizontal(c.dir));
        outer: for (const a of hCars) {
          const ra = carRect(a);
          for (const b of vCars) {
            if (rectsOverlap(ra, carRect(b))) {
              crashPairRef.current = [a, b];
              shakeRef.current = 14;
              endRun();
              break outer;
            }
          }
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
      ctx.fillRect(-20, -20, CW + 40, CH + 40);

      // roads
      ctx.fillStyle = "#e3dac9";
      ctx.fillRect(0, YC - HALF, CW, HALF * 2);
      ctx.fillRect(XC - HALF, 0, HALF * 2, CH);
      // center dashes
      ctx.strokeStyle = "rgba(41,36,32,0.25)";
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(0, YC);
      ctx.lineTo(XC - HALF, YC);
      ctx.moveTo(XC + HALF, YC);
      ctx.lineTo(CW, YC);
      ctx.moveTo(XC, 0);
      ctx.lineTo(XC, YC - HALF);
      ctx.moveTo(XC, YC + HALF);
      ctx.lineTo(XC, CH);
      ctx.stroke();
      ctx.setLineDash([]);

      // stop lines, tinted by light state
      const light = lightRef.current;
      const hColor = light === "H" ? "rgba(138,154,91,0.9)" : "rgba(201,111,74,0.9)";
      const vColor = light === "V" ? "rgba(138,154,91,0.9)" : "rgba(201,111,74,0.9)";
      ctx.lineWidth = 5;
      ctx.strokeStyle = hColor;
      ctx.beginPath();
      ctx.moveTo(XC - HALF - 8, YC);
      ctx.lineTo(XC - HALF - 8, YC + HALF);
      ctx.moveTo(XC + HALF + 8, YC - HALF);
      ctx.lineTo(XC + HALF + 8, YC);
      ctx.stroke();
      ctx.strokeStyle = vColor;
      ctx.beginPath();
      ctx.moveTo(XC - HALF, YC - HALF - 8);
      ctx.lineTo(XC, YC - HALF - 8);
      ctx.moveTo(XC, YC + HALF + 8);
      ctx.lineTo(XC + HALF, YC + HALF + 8);
      ctx.stroke();

      // cars
      for (const car of carsRef.current) {
        const r = carRect(car);
        const crashed = crashPairRef.current.includes(car);
        ctx.fillStyle = crashed ? "#c96f4a" : COLORS[car.color % COLORS.length];
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(41,36,32,0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // score, center-top
      if (phaseRef.current !== "ready") {
        ctx.fillStyle = "rgba(41,36,32,0.85)";
        ctx.font = "bold 42px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(scoreRef.current), XC, 52);
      }

      if (phaseRef.current === "ready") {
        ctx.fillStyle = "rgba(41,36,32,0.75)";
        ctx.font = "bold 26px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText("tap to open the intersection", XC, YC - 100);
        ctx.font = "15px ui-sans-serif, system-ui";
        ctx.fillText(`every tap switches the light · ${DAILY_GOAL} cars = daily goal`, XC, YC - 72);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = async () => {
    // traffic bar: one car per 5 passed, capped at a lane of 10
    const lane = "🚗".repeat(Math.max(1, Math.min(10, Math.floor(best / 5))));
    const text = buildShare("RUSH", num, [
      `🚦${lane}`,
      `${best} cars${best >= DAILY_GOAL ? " · goal cleared ✅" : ` · goal ${DAILY_GOAL}`}`,
    ]);
    const outcome = await shareResult(text);
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full">
      <div className="stat-bar">
        <div className="stat">
          <span className="lab">Cars</span>
          <span className="val">{score}</span>
        </div>
        <div className="stat">
          <span className="lab">Goal</span>
          <span className="val">{DAILY_GOAL}</span>
        </div>
        <div className="stat">
          <span className="lab">Best today</span>
          <span className="val">{best}</span>
        </div>
        <div className="stat">
          <span className="lab">Streak</span>
          <span className="val">{streak}🔥</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="board" style={{ aspectRatio: `${CW}/${CH}` }} />

      <p className="hint">
        tap anywhere<span className="hidden sm:inline"> (or space)</span> to switch the light · don&apos;t
        let them touch · <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {showHelp && (
        <div className="scrim absolute inset-0 flex items-center justify-center rounded-2xl z-20 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-4 text-center">How to play</h2>
            <ol className="space-y-3 text-stone-600 text-sm leading-relaxed">
              <li>
                <span className="text-stone-900 font-semibold">1. You are the traffic light.</span> One
                tap switches which road flows — green lines go, red lines wait.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">2. Cars keep coming, faster and faster.</span>{" "}
                Everyone gets the same traffic today.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">3. One touch = game over.</span> A car
                already in the crossing can&apos;t stop — time your switches.
              </li>
              <li>
                <span className="text-stone-900 font-semibold">4. Pass {DAILY_GOAL} cars</span> to clear
                the daily goal. Then chase the high score.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:rush:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it — open the road
            </button>
          </div>
        </div>
      )}

      {phase === "crashed" && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel text-center max-w-sm">
            <div className="text-4xl mb-2">💥</div>
            <h2 className="font-serif text-2xl font-bold text-stone-900 mb-1">Pile-up!</h2>
            <p className="text-stone-600 mb-1">
              RUSH #{num}: <span className="text-stone-900 font-bold">{score} cars</span>
              {score >= DAILY_GOAL ? " · daily goal cleared ✅" : ` · goal is ${DAILY_GOAL}`}
            </p>
            <p className="text-xs text-stone-400 mb-4">Best today: {best}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={share} className="btn-ink px-5 py-2.5">
                {copied ? "Shared ✓" : "Share result"}
              </button>
              <button onClick={startRun} className="btn-line px-5 py-2.5">
                Again
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-4">
              Same traffic for everyone · <Countdown prefix="new rush in" />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
