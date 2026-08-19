"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { useEffect, useRef, useState } from "react";
import {
  ACCEL,
  AXIS_LEN,
  CAR_LEN,
  CARS_PER_LEVEL,
  CH,
  CRUISE,
  CW,
  Car,
  Dir,
  GAP,
  HALF,
  LANE,
  STOP,
  SpawnEvent,
  TOTAL_LEVELS,
  XC,
  YC,
  carRect,
  creepOf,
  isHorizontal,
  makeTrafficStream,
  patienceFor,
  progressFromCars,
  rectsOverlap,
} from "./engine";
import GuideLink from "@/components/GuideLink";
import { reportLevelProgress } from "@/lib/sdk/leaderboard";
import { shareLevel } from "@/lib/sdk/levelShare";
import { blip, chirp } from "@/lib/sdk/sound";
import { applyView, inScreenSpace } from "@/lib/sdk/viewport";
import PuzzleRating from "@/components/PuzzleRating";
import Celebration from "@/components/Celebration";
import {
  readWeeklyProgress,
  readStoredNumber,
  weekLabel,
  weeklySeed,
  weeklyStorageKey,
  writeWeeklyProgress,
} from "@/lib/sdk/weekly";

const COLORS = ["#c96f4a", "#d9a441", "#8a9a5b", "#6f8fa8", "#9d7a94", "#b25d6d"];

// "crashing" is the beat between the impact and the summary panel - the wreck
// needs a moment to read as a wreck, otherwise the panel appears out of nowhere
// and nobody knows what they did wrong.
type Phase = "ready" | "run" | "crashing" | "crashed";

const CRASH_BEAT = 1.35; // seconds of wreckage before the panel slides in

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  rot: number;
  size: number;
  life: number;
  color: string;
}

// A compact top-down car drawn from primitives. Keeping it in the canvas makes
// the game fast and crisp at every screen size while adding the wheels, cabin,
// glass and lights that distinguish it from the old rounded box.
function drawCar(
  ctx: CanvasRenderingContext2D,
  car: Car,
  bodyColor: string,
  crashed: boolean
) {
  const r = carRect(car);
  const angle = car.dir === 0 ? 0 : car.dir === 1 ? Math.PI : car.dir === 2 ? Math.PI / 2 : -Math.PI / 2;

  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.rotate(angle);

  // Four small tyres sit just outside the body silhouette.
  ctx.fillStyle = "#332f2b";
  for (const x of [-16, 8]) {
    ctx.beginPath();
    ctx.roundRect(x, -14, 9, 4, 2);
    ctx.roundRect(x, 10, 9, 4, 2);
    ctx.fill();
  }

  // Tapered nose and tail read as a vehicle even when the car is moving fast.
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-23, -8);
  ctx.quadraticCurveTo(-20, -11, -14, -11);
  ctx.lineTo(13, -11);
  ctx.quadraticCurveTo(21, -9, 23, -4);
  ctx.lineTo(23, 4);
  ctx.quadraticCurveTo(21, 9, 13, 11);
  ctx.lineTo(-14, 11);
  ctx.quadraticCurveTo(-20, 11, -23, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = crashed ? "rgba(41,36,32,0.8)" : "rgba(41,36,32,0.42)";
  ctx.lineWidth = crashed ? 2.5 : 1.4;
  ctx.stroke();

  // Cabin and windscreens.
  ctx.fillStyle = "rgba(224,238,239,0.78)";
  ctx.beginPath();
  ctx.roundRect(-9, -8, 21, 16, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(41,36,32,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(5, 8);
  ctx.moveTo(-5, -8);
  ctx.lineTo(-5, 8);
  ctx.stroke();

  // Headlights at the nose, red tail lights at the back.
  ctx.fillStyle = "#f7e5a3";
  ctx.fillRect(20, -8, 2.5, 4);
  ctx.fillRect(20, 4, 2.5, 4);
  ctx.fillStyle = "#a9433c";
  ctx.fillRect(-23, -8, 2.5, 4);
  ctx.fillRect(-23, 4, 2.5, 4);
  ctx.restore();
}

export default function RushGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [totalCars, setTotalCars] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [levelNotice, setLevelNotice] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [showHelp, setShowHelp] = useState(false);
  const [crashHidden, setCrashHidden] = useState(false);
  const [shared, setShared] = useState(false);
  const [showFinale, setShowFinale] = useState(false);

  const carsRef = useRef<Car[]>([]);
  const lightRef = useRef<"H" | "V">("H");
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const totalCarsRef = useRef(0);
  const completedRef = useRef(0);
  const runLevelRef = useRef(1);
  const noticeTimerRef = useRef<number | null>(null);
  const simTRef = useRef(0);
  const streamRef = useRef<ReturnType<typeof makeTrafficStream> | null>(null);
  const nextEventRef = useRef<SpawnEvent | null>(null);
  // cars whose scheduled arrival has passed but whose entry was still blocked -
  // held per direction so the seeded traffic stays independent of framerate
  const pendingRef = useRef<Record<Dir, number[]>>({ 0: [], 1: [], 2: [], 3: [] });
  const crashPairRef = useRef<Car[]>([]);
  const crashAtRef = useRef(0);
  const crashPtRef = useRef({ x: XC, y: YC });
  const debrisRef = useRef<Debris[]>([]);
  const patienceRef = useRef(0);
  const shakeRef = useRef(0);
  const portraitRef = useRef(false);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const saveLevelRecord = (level: number) => {
    const safeLevel = Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(level)));
    if (safeLevel <= completedRef.current) return;
    completedRef.current = safeLevel;
    setCompleted(safeLevel);
    writeWeeklyProgress("rush", safeLevel);
    void reportLevelProgress("rush", safeLevel);
  };

  const startRun = () => {
    carsRef.current = [];
    lightRef.current = "H";
    scoreRef.current = 0;
    setScore(0);
    totalCarsRef.current = 0;
    setTotalCars(0);
    runLevelRef.current = 1;
    const stream = makeTrafficStream(weeklySeed("rush"), runLevelRef.current);
    streamRef.current = stream;
    nextEventRef.current = stream.next();
    pendingRef.current = { 0: [], 1: [], 2: [], 3: [] };
    simTRef.current = 0;
    crashPairRef.current = [];
    debrisRef.current = [];
    patienceRef.current = patienceFor(0, runLevelRef.current);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setLevelNotice(null);
    setCrashHidden(false);
    blip(520, 0.09, "triangle", 0.06);
    setPhaseBoth("run");
  };

  const tap = () => {
    if (phaseRef.current === "ready") {
      startRun();
      return;
    }
    if (phaseRef.current === "run") {
      lightRef.current = lightRef.current === "H" ? "V" : "H";
      blip(680, 0.05, "square", 0.045); // the light clacks over
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const savedLevel = readWeeklyProgress("rush");
    totalCarsRef.current = 0;
    completedRef.current = savedLevel;
    bestRef.current = readStoredNumber(weeklyStorageKey("rush", "best-run"));
    setTotalCars(0);
    setCompleted(savedLevel);
    setBest(bestRef.current);
    if (!window.localStorage.getItem("gd:rush:help:v3")) setShowHelp(true);

    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

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

    // the impact itself: freeze the traffic, throw wreckage, shake the camera.
    // Saving and the summary panel are deliberately deferred to endRun so the
    // player actually sees the collision that ended their run.
    const startCrash = () => {
      chirp(280, 45, 0.5, "sawtooth", 0.1);
      shakeRef.current = 24;
      crashAtRef.current = performance.now();
      const { x, y } = crashPtRef.current;
      const paint = crashPairRef.current.map((c) => COLORS[c.color % COLORS.length]);
      const bits: Debris[] = [];
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
        const sp = 90 + Math.random() * 210;
        bits.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          spin: (Math.random() - 0.5) * 14,
          rot: Math.random() * Math.PI,
          size: 3 + Math.random() * 5,
          life: 0.55 + Math.random() * 0.8,
          color: paint[i % Math.max(1, paint.length)] ?? "#8a6a5b",
        });
      }
      debrisRef.current = bits;
      setPhaseBoth("crashing");
    };

    const endRun = () => {
      const s = scoreRef.current;
      saveLevelRecord(progressFromCars(totalCarsRef.current).level);
      if (s > bestRef.current) {
        bestRef.current = s;
        setBest(s);
        try {
          window.localStorage.setItem(weeklyStorageKey("rush", "best-run"), String(s));
        } catch {}
      }
      setPhaseBoth("crashed");
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // ---- simulate ----
      if (phaseRef.current === "run") {
        // Simulated time, not wall-clock. dt is capped at 50ms, so a throttled
        // or backgrounded tab advances the physics slowly - if the schedule ran
        // off the wall clock instead, coming back to the tab would bank a minute
        // of traffic and dump an unavoidable wall of cars onto the board.
        simTRef.current += dt;
        const elapsed = simTRef.current;
        const stream = streamRef.current;

        // release every car the schedule says has arrived by now into its
        // direction's holding queue, then put as many on the road as fit
        while (stream && nextEventRef.current && nextEventRef.current.t <= elapsed) {
          const ev = nextEventRef.current;
          pendingRef.current[ev.dir].push(ev.color);
          nextEventRef.current = stream.next();
        }
        for (const dir of [0, 1, 2, 3] as const) {
          const queue = pendingRef.current[dir];
          if (queue.length === 0) continue;
          const clear = carsRef.current.every((c) => c.dir !== dir || c.pos > CAR_LEN + GAP + 8);
          if (!clear) continue;
          carsRef.current.push({
            dir,
            pos: 0,
            v: CRUISE * 0.6,
            color: queue.shift() as number,
            counted: false,
            wait: 0,
            jumped: false,
          });
        }

        const patience = patienceFor(elapsed, runLevelRef.current);
        patienceRef.current = patience;
        const light = lightRef.current;
        for (const dir of [0, 1, 2, 3] as const) {
          const group = carsRef.current.filter((c) => c.dir === dir).sort((a, b) => b.pos - a.pos);
          const green = isHorizontal(dir) ? light === "H" : light === "V";
          for (let i = 0; i < group.length; i++) {
            const car = group[i];
            if (green) car.wait = 0;
            // only the car at the front of a red queue loses its patience -
            // the ones behind it are held back by metal, not by the light
            const atLine = !green && !car.jumped && i === 0 && car.pos >= STOP[dir] - 4;
            if (atLine) {
              car.wait += dt;
              if (car.wait >= patience) {
                car.jumped = true;
                chirp(360, 250, 0.16, "square", 0.05); // a short, annoyed horn
              }
            }
            // A car is held only while it is still at (or creeping toward) its
            // own line. Two pixels past it, the car is committed and the light
            // no longer stops it - that is the "already in the crossing" rule.
            // Widening this window let a player mash the light and freeze cars
            // at the mouth of the box forever without ever colliding.
            let limit = Infinity;
            const line = STOP[dir] + creepOf(car, patience);
            if (!green && !car.jumped && car.pos <= line + 2) limit = line;
            if (i > 0) limit = Math.min(limit, group[i - 1].pos - CAR_LEN - GAP);
            const room = limit - car.pos;
            if (room > 1) {
              car.v = Math.min(CRUISE, car.v + ACCEL * dt);
              car.pos = Math.min(limit, car.pos + car.v * dt);
            } else if (room > 0) {
              car.pos = limit; // settle onto the line without jittering
              car.v = 0;
            } else {
              car.v = 0;
            }
            if (!car.counted && car.pos - CAR_LEN > (isHorizontal(dir) ? XC + HALF : YC + HALF)) {
              car.counted = true;
              // A driver who gave up and ran the red is a failure of your
              // signalling, not a car you waved through, so it earns nothing.
              // Without this, neglecting a road still paid out: on a quiet day
              // the red-runners slipped across empty tarmac and an idle player
              // could still scrape level progress.
              if (!car.jumped) {
                scoreRef.current += 1;
                setScore(scoreRef.current);
                if (totalCarsRef.current < TOTAL_LEVELS * CARS_PER_LEVEL) {
                  totalCarsRef.current += 1;
                  setTotalCars(totalCarsRef.current);
                  const progress = progressFromCars(totalCarsRef.current);
                  if (progress.level > runLevelRef.current) {
                    runLevelRef.current = progress.level;
                    streamRef.current?.setLevel(progress.level);
                    setLevelNotice(progress.completed);
                    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
                    noticeTimerRef.current = window.setTimeout(() => setLevelNotice(null), 2400);
                  }
                  if (progress.completed >= TOTAL_LEVELS) {
                    saveLevelRecord(TOTAL_LEVELS);
                    setPhaseBoth("ready");
                    setShowFinale(true);
                  }
                }
              }
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
            const rb = carRect(b);
            if (rectsOverlap(ra, rb)) {
              crashPairRef.current = [a, b];
              crashPtRef.current = {
                x: (Math.max(ra.x, rb.x) + Math.min(ra.x + ra.w, rb.x + rb.w)) / 2,
                y: (Math.max(ra.y, rb.y) + Math.min(ra.y + ra.h, rb.y + rb.h)) / 2,
              };
              startCrash();
              break outer;
            }
          }
        }
      }

      // wreckage keeps moving while the crash beat plays out, then the panel
      if (phaseRef.current === "crashing") {
        for (const d of debrisRef.current) {
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.vx *= 0.94;
          d.vy *= 0.94;
          d.rot += d.spin * dt;
          d.life -= dt;
        }
        debrisRef.current = debrisRef.current.filter((d) => d.life > 0);
        if ((now - crashAtRef.current) / 1000 >= CRASH_BEAT) endRun();
      }

      // ---- render ----
      const view = applyView(canvas, ctx, CW, CH, portraitRef.current, "#efe8db");
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
      const pulse = 0.5 + 0.5 * Math.sin(now / 90);
      const wrecking = phaseRef.current === "crashing" || phaseRef.current === "crashed";
      for (const car of carsRef.current) {
        const r = carRect(car);
        const crashed = crashPairRef.current.includes(car);

        // an impatient driver warms up amber, then red, then jumps the light.
        // This ring is the whole fairness contract of the red-run: you always
        // get to see it coming and can flip the light before they move.
        if (!crashed) {
          const urgency = car.jumped ? 1 : Math.min(1, car.wait / (patienceRef.current || 1));
          if (urgency > 0.55) {
            const heat = (urgency - 0.55) / 0.45;
            ctx.save();
            ctx.globalAlpha = 0.28 + 0.55 * heat * pulse;
            ctx.strokeStyle = car.jumped ? "#c0392b" : "#d9a441";
            ctx.lineWidth = 2 + 3 * heat;
            ctx.beginPath();
            ctx.roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 9);
            ctx.stroke();
            ctx.restore();
          }
        }

        // the two cars that touched flash so the eye lands on the cause
        const bodyColor = crashed
          ? wrecking && pulse > 0.5
            ? "#e8503a"
            : "#c0392b"
          : COLORS[car.color % COLORS.length];
        drawCar(ctx, car, bodyColor, crashed);
      }

      // ---- the wreck ----
      if (wrecking) {
        const age = (now - crashAtRef.current) / 1000;
        const { x: cx, y: cy } = crashPtRef.current;

        // white-hot flash at the point of contact
        if (age < 0.22) {
          ctx.save();
          ctx.globalAlpha = (1 - age / 0.22) * 0.85;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 95);
          g.addColorStop(0, "#fff6e8");
          g.addColorStop(0.45, "rgba(232,80,58,0.5)");
          g.addColorStop(1, "rgba(232,80,58,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, 95, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // two staggered shockwaves rolling out of the crossing
        for (const delay of [0, 0.14]) {
          const a = age - delay;
          if (a < 0 || a > 0.6) continue;
          const k = a / 0.6;
          ctx.save();
          ctx.globalAlpha = (1 - k) * 0.55;
          ctx.strokeStyle = "#c0392b";
          ctx.lineWidth = 5 * (1 - k) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, 20 + k * 140, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // paint flakes and glass
        for (const d of debrisRef.current) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, d.life * 1.7);
          ctx.translate(d.x, d.y);
          ctx.rotate(d.rot);
          ctx.fillStyle = d.color;
          ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
          ctx.restore();
        }
      }

      // HUD text pinned to screen space - stays upright even when the world rotates
      inScreenSpace(ctx, view, (elW, elH) => {
        ctx.textAlign = "center";
        if (phaseRef.current !== "ready") {
          ctx.fillStyle = "rgba(41,36,32,0.85)";
          ctx.font = "bold 42px ui-sans-serif, system-ui";
          ctx.fillText(String(scoreRef.current), elW / 2, 54);
          // name the disaster while the wreck is still on screen, so the
          // summary panel lands as a consequence and not as a surprise. This
          // sits right on top of the crash point, where the cars, the rings
          // and the shockwave are all some shade of red - red text there just
          // vanished. A dark badge plate gives it a background that never
          // matches whatever's under it, and a little pop-in keeps the "that
          // just happened" jolt instead of reading as a calm label.
          if (phaseRef.current === "crashing") {
            const age = (now - crashAtRef.current) / 1000;
            const t = Math.min(1, age / 0.18);
            const eased = 1 - (1 - t) * (1 - t);
            ctx.save();
            ctx.globalAlpha = eased;
            ctx.translate(elW / 2, elH / 2 - 8);
            ctx.scale(0.86 + 0.14 * eased, 0.86 + 0.14 * eased);
            ctx.font = "900 38px ui-sans-serif, system-ui";
            const label = "PILE-UP!";
            const w = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(24,19,16,0.88)";
            ctx.strokeStyle = "#e8503a";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(-w / 2 - 22, -32, w + 44, 56, 999);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#fff6ec";
            ctx.textBaseline = "middle";
            ctx.fillText(label, 0, -2);
            ctx.restore();
          }
        } else {
          ctx.fillStyle = "rgba(41,36,32,0.75)";
          ctx.font = "bold 24px ui-sans-serif, system-ui";
          ctx.fillText("tap to open the intersection", elW / 2, elH / 2 - 110);
          ctx.font = "15px ui-sans-serif, system-ui";
          ctx.fillText(
            `every tap switches the light · ${CARS_PER_LEVEL} safe cars = one level`,
            elW / 2,
            elH / 2 - 84
          );
        }
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", applyOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = progressFromCars(totalCars);
  const progressPct = (progress.carsInLevel / CARS_PER_LEVEL) * 100;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="stat-bar shrink-0">
        <div className="stat">
          <span className="lab">Level</span>
          <span className="val">{progress.level}</span>
        </div>
        <div className="stat">
          <span className="lab">Best level</span>
          <span className="val">{completed}</span>
        </div>
        <div className="stat">
          <span className="lab">This level</span>
          <span className="val">{progress.carsInLevel}/{CARS_PER_LEVEL}</span>
        </div>
        <div className="stat">
          <span className="lab">This run</span>
          <span className="val">{score}</span>
        </div>
        <div className="stat">
          <span className="lab">Week</span>
          <span className="val">{weekLabel()}</span>
        </div>
        <div className="stat">
          <span className="lab">Best run</span>
          <span className="val">{best}</span>
        </div>
      </div>

      {levelNotice !== null && (
        <div className="shrink-0 mx-2 mt-1 rounded-full bg-[#ffa23e] px-3 py-1 text-center text-xs font-bold text-[#241b13]">
          Level {levelNotice} complete!{" "}
          {levelNotice < TOTAL_LEVELS ? `Level ${levelNotice + 1} unlocked` : "Weekly run complete"}
        </div>
      )}

      <div className="shrink-0 px-3 pt-1.5 pb-1">
        <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] tx-muted">
          <span>Level {progress.level} progress</span>
          <span>{progress.carsInLevel}/{CARS_PER_LEVEL} safe cars</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
          <div
            className="h-full rounded-full bg-[#ffa23e] transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
      </div>

      <p className="hint shrink-0">
        tap anywhere<span className="hidden sm:inline"> (or space)</span> to switch the light ·{" "}
        {CARS_PER_LEVEL} safe cars complete a level · best level survives crashes ·{" "}
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
                  window.localStorage.setItem("gd:rush:help:v3", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. You are the traffic light.</span> One
                tap switches which road flows - green lines go, red lines wait.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Cars keep coming, faster and faster.</span>{" "}
                Every level reached in the current run makes traffic and impatient drivers tougher.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. One touch = game over.</span> A car
                already in the crossing can&apos;t stop - time your switches.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Nobody waits forever.</span> Leave a
                road on red too long and the front driver glows amber, creeps forward, then runs
                the light. Red-runners don&apos;t score - you can&apos;t favour one road.
              </li>
              <li>
                <span className="tx-ink font-semibold">
                  5. Every {CARS_PER_LEVEL} safe cars completes a level.
                </span>{" "}
                After a pile-up, your highest level is saved as the weekly record and the next run
                starts fresh at Level 1. Monday starts a shared traffic remix; your career best remains saved.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:rush:help:v3", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - open the road
            </button>
            <GuideLink game="rush" />
          </div>
        </div>
      )}

      {/* dismissed the summary to look at the wreck? this keeps the next run
          one tap away so nobody gets stranded staring at a dead intersection */}
      {phase === "crashed" && crashHidden && (
        <button
          onClick={startRun}
          className="btn-ink fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 shadow-xl"
        >
          Again from Level 1
        </button>
      )}

      {phase === "crashed" && !crashHidden && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel text-center max-w-sm relative">
            <button className="panel-x" aria-label="Close" onClick={() => setCrashHidden(true)}>
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <div className="text-4xl mb-2">💥</div>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-1">Pile-up!</h2>
            <p className="tx-muted mb-1">
              <span className="tx-ink font-bold">{score} cars</span> passed this run
            </p>
            <p className="text-xs tx-soft mb-4">
              Level {progress.level} · {progress.carsInLevel}/{CARS_PER_LEVEL} cars · best run {best}
            </p>
            {/* RUSH has no per-level panel - this crash box is where a run ends,
                so the share lives here, with the retry stepped down beside it */}
            <div className="flex gap-2.5 justify-center items-center flex-wrap">
              <button
                onClick={async () => {
                  const outcome = await shareLevel("rush", progress.level);
                  if (outcome === "failed") return;
                  setShared(true);
                  window.setTimeout(() => setShared(false), 2000);
                }}
                className="btn-ink px-6 py-2.5"
              >
                {shared ? "Shared ✓" : "Challenge a friend"}
              </button>
              <button onClick={startRun} className="btn-line px-5 py-2.5">
                Again from Level 1
              </button>
            </div>
            <PuzzleRating game="rush" quiet />
            <p className="text-xs tx-soft mt-4">
              Best level {completed} is saved. Every new run starts at Level 1.
            </p>
          </div>
        </div>
      )}

      {showFinale && (
        <Celebration
          title="Weekly RUSH run complete!"
          stars={3}
          score={{ label: "best level", value: completed }}
          badges={[`${score} cars this run`, "Weekly run complete"]}
          primary={{
            label: "Keep playing",
            onClick: () => {
              setShowFinale(false);
              startRun();
            },
          }}
          secondary={{
            label: "Back home",
            onClick: () => {
              window.location.href = "/";
            },
          }}
          feedback="rush"
          finalWeek
        />
      )}
    </div>
  );
}
