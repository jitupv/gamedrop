"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import {
  BEACON_R,
  H,
  Hole,
  Probe,
  STAR_R,
  Vec,
  W,
  endlessHole,
  generateCourse,
  launchVelocity,
  previewPath,
  simStep,
} from "./engine";
import { challengeNumber, todayKey } from "@/lib/sdk/daily";
import ModeSwitch from "@/components/ModeSwitch";
import GuideLink from "@/components/GuideLink";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { reportEndlessBest } from "@/lib/sdk/leaderboard";
import { buildShare, challengeUrl, shareResult } from "@/lib/sdk/share";
import { blip, chirp } from "@/lib/sdk/sound";
import { View, applyView, pointToGame } from "@/lib/sdk/viewport";
import Celebration from "@/components/Celebration";

type Status = "idle" | "aiming" | "flying" | "resetting" | "holeDone" | "courseDone" | "runOver";
type Mode = "daily" | "endless";

const START_FUEL = 8;
// daily: hard shot budget per hole - run dry and the hole is picked up as a bogey (+2)
const DAILY_FUEL = [8, 9, 10];
const BOGEY_PENALTY = 2;
// aim pressure: the ring around the probe closes in this many seconds -
// release before it shuts or the shot is spent. Generous on hole 1, tighter
// each hole after; endless keeps squeezing as the run goes deeper.
const AIM_TIMES = [10, 8, 6];
const aimTimeFor = (mode: Mode, holeIdx: number) =>
  mode === "endless" ? Math.max(4, 10 - holeIdx * 0.5) : AIM_TIMES[Math.min(holeIdx, AIM_TIMES.length - 1)];

function readOrbitEndlessBest(): number {
  try {
    return Number(window.localStorage.getItem("gd:orbit:endless-best") || 0);
  } catch {
    return 0;
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

const HOLES = 3;

export default function OrbitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [holeIdx, setHoleIdx] = useState(0);
  const [holeLaunches, setHoleLaunches] = useState(0);
  const [totals, setTotals] = useState<number[]>([]);
  const [starsWon, setStarsWon] = useState<boolean[]>([]);
  const [num, setNum] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState<Mode>("daily");
  const [fuel, setFuel] = useState(START_FUEL);
  const [cleared, setCleared] = useState(0);
  const [endlessBest, setEndlessBest] = useState(0);
  const [portrait, setPortrait] = useState(false);

  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const modeRef = useRef<Mode>("daily");
  const fuelRef = useRef(START_FUEL);
  const clearedRef = useRef(0);
  const runSeedRef = useRef("");
  // Mutable sim state lives in refs - the rAF loop reads these, React state is UI-only.
  const courseRef = useRef<Hole[]>([]);
  const holeRef = useRef<Hole | null>(null);
  const probeRef = useRef<Probe>({ x: 0, y: 0, vx: 0, vy: 0 });
  const trailRef = useRef<Vec[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef(0);
  const statusRef = useRef<Status>("idle");
  const holeLaunchesRef = useRef(0);
  const starTakenRef = useRef(false);
  const aimRef = useRef<{ start: Vec; cur: Vec } | null>(null);
  const aimStartRef = useRef(0);
  const dayRef = useRef("");

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const burst = (x: number, y: number, hue: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        hue: hue + Math.random() * 40 - 20,
      });
    }
  };

  const holeIdxRef = useRef(0);

  const loadHoleDirect = (hole: Hole, idx: number) => {
    holeIdxRef.current = idx;
    holeRef.current = hole;
    probeRef.current = { x: hole.start.x, y: hole.start.y, vx: 0, vy: 0 };
    trailRef.current = [];
    holeLaunchesRef.current = 0;
    starTakenRef.current = false;
    setHoleLaunches(0);
    setHoleIdx(idx);
    setStatusBoth("idle");
  };

  const loadHole = (idx: number) => loadHoleDirect(courseRef.current[idx], idx);

  const startEndless = () => {
    modeRef.current = "endless";
    setMode("endless");
    setEndlessBest(readOrbitEndlessBest());
    fuelRef.current = START_FUEL;
    setFuel(START_FUEL);
    clearedRef.current = 0;
    setCleared(0);
    runSeedRef.current = `orbit:endless:${Math.random().toString(36).slice(2, 9)}`;
    loadHoleDirect(endlessHole(runSeedRef.current, 0), 0);
  };

  const backToDaily = () => {
    modeRef.current = "daily";
    setMode("daily");
    setTotals([]);
    setStarsWon([]);
    if (courseRef.current.length > 0) loadHole(0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const day = todayKey();
    dayRef.current = day;
    setNum(challengeNumber("orbit"));
    setStreak(getStreak("orbit", day));
    if (!window.localStorage.getItem("gd:orbit:help")) setShowHelp(true);

    // course generation runs the solver - defer a tick so the shell paints first
    let cancelled = false;
    setLoading(true);
    window.setTimeout(() => {
      if (cancelled) return;
      courseRef.current = generateCourse(day);
      loadHole(0);
      setLoading(false);
    }, 30);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    // portrait phones: the whole playfield rotates 90° so it fills the screen
    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
      setPortrait(mq.matches);
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

    const toGame = (e: PointerEvent): Vec => {
      const v = viewRef.current;
      if (!v) return { x: -9999, y: -9999 };
      return pointToGame(v, canvas, e.clientX, e.clientY, W);
    };

    const onDown = (e: PointerEvent) => {
      if (statusRef.current !== "idle") return;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      const p = toGame(e);
      aimRef.current = { start: p, cur: p };
      aimStartRef.current = performance.now();
      setStatusBoth("aiming");
    };
    const onMove = (e: PointerEvent) => {
      if (statusRef.current === "aiming" && aimRef.current) aimRef.current.cur = toGame(e);
    };
    const onUp = () => {
      if (statusRef.current !== "aiming" || !aimRef.current || !holeRef.current) return;
      const { start, cur } = aimRef.current;
      const { vx, vy } = launchVelocity(start, cur);
      aimRef.current = null;
      if (Math.hypot(vx, vy) < 0.8) {
        setStatusBoth("idle"); // accidental tap
        return;
      }
      if (modeRef.current === "endless") {
        if (fuelRef.current <= 0) {
          setStatusBoth("idle");
          return;
        }
        fuelRef.current -= 1;
        setFuel(fuelRef.current);
      } else if (holeLaunchesRef.current >= DAILY_FUEL[holeIdxRef.current]) {
        // tank empty - golf pickup rule: bogey the hole, penalty on the card
        holeLaunchesRef.current += BOGEY_PENALTY;
        setHoleLaunches(holeLaunchesRef.current);
        chirp(320, 90, 0.4, "sawtooth", 0.07);
        finishHole();
        return;
      }
      const hole = holeRef.current;
      probeRef.current = { x: hole.start.x, y: hole.start.y, vx, vy };
      trailRef.current = [];
      holeLaunchesRef.current += 1;
      setHoleLaunches(holeLaunchesRef.current);
      chirp(150, 430, 0.2, "triangle", 0.06);
      setStatusBoth("flying");
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);

    let raf = 0;
    let tick = 0;

    const finishHole = () => {
      const idx = holeIdxRef.current;
      const launches = holeLaunchesRef.current;
      const star = starTakenRef.current;

      if (modeRef.current === "endless") {
        clearedRef.current += 1;
        setCleared(clearedRef.current);
        fuelRef.current += 3 + (star ? 1 : 0) + (launches === 1 ? 1 : 0);
        setFuel(fuelRef.current);
        if (clearedRef.current > readOrbitEndlessBest()) {
          try {
            window.localStorage.setItem("gd:orbit:endless-best", String(clearedRef.current));
            reportEndlessBest("orbit", clearedRef.current);
          } catch {}
          setEndlessBest(clearedRef.current);
        }
        setStarsWon((s) => {
          const next = [...s];
          next[idx] = star;
          return next;
        });
        setTotals((t) => {
          const next = [...t];
          next[idx] = launches;
          return next;
        });
        setStatusBoth("holeDone");
        return;
      }

      setTotals((t) => {
        const next = [...t];
        next[idx] = launches;
        return next;
      });
      setStarsWon((s) => {
        const next = [...s];
        next[idx] = star;
        return next;
      });
      if (idx >= HOLES - 1) {
        setStatusBoth("courseDone");
      } else {
        setStatusBoth("holeDone");
      }
    };

    const draw = () => {
      tick++;
      const hole = holeRef.current;
      if (!hole) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (statusRef.current === "flying") {
        const probe = probeRef.current;
        const outcome = simStep(probe, hole);
        trailRef.current.push({ x: probe.x, y: probe.y });
        if (trailRef.current.length > 400) trailRef.current.shift();

        if (!starTakenRef.current && Math.hypot(hole.star.x - probe.x, hole.star.y - probe.y) < STAR_R + 6) {
          starTakenRef.current = true;
          blip(1046, 0.14, "triangle", 0.08);
          burst(hole.star.x, hole.star.y, 50, 16);
        }

        if (outcome === "won") {
          burst(hole.beacon.x, hole.beacon.y, 160, 26);
          finishHole();
        } else if (outcome === "crashed" || outcome === "lost") {
          if (outcome === "crashed") {
            burst(probe.x, probe.y, 20, 22);
            shakeRef.current = 10;
            blip(75, 0.3, "sawtooth", 0.09);
          } else {
            chirp(320, 70, 0.35, "sine", 0.05); // drifted into the void
          }
          setStatusBoth("resetting");
          window.setTimeout(() => {
            if (statusRef.current !== "resetting" || !holeRef.current) return;
            probeRef.current = { x: holeRef.current.start.x, y: holeRef.current.start.y, vx: 0, vy: 0 };
            trailRef.current = [];
            if (modeRef.current === "endless" && fuelRef.current <= 0) {
              // tank empty and the beacon unreached - the run is over
              if (clearedRef.current > readOrbitEndlessBest()) {
                try {
                  window.localStorage.setItem("gd:orbit:endless-best", String(clearedRef.current));
                  reportEndlessBest("orbit", clearedRef.current);
                } catch {}
                setEndlessBest(clearedRef.current);
              }
              setStatusBoth("runOver");
            } else {
              setStatusBoth("idle");
            }
          }, 600);
        }
      }

      // ---- render ----
      viewRef.current = applyView(canvas, ctx, W, H, portraitRef.current, "#05060f");
      if (shakeRef.current > 0) {
        shakeRef.current *= 0.85;
        if (shakeRef.current < 0.3) shakeRef.current = 0;
        ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
      }
      ctx.fillStyle = "#05060f";
      ctx.fillRect(-20, -20, W + 40, H + 40);

      for (const s of hole.bgStars) {
        ctx.fillStyle = `rgba(220,230,255,${s.b})`;
        ctx.fillRect(s.x, s.y, 1.4, 1.4);
      }

      for (const pl of hole.planets) {
        const g = ctx.createRadialGradient(
          pl.x - pl.r * 0.35,
          pl.y - pl.r * 0.35,
          pl.r * 0.15,
          pl.x,
          pl.y,
          pl.r
        );
        g.addColorStop(0, `hsl(${pl.hue} 32% 58%)`);
        g.addColorStop(1, `hsl(${pl.hue} 30% 20%)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `hsla(${pl.hue} 35% 68% / 0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, pl.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // bonus star
      if (!starTakenRef.current) {
        const s = hole.star;
        const rot = tick * 0.03;
        ctx.fillStyle = "rgba(255,215,80,0.95)";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 === 0 ? STAR_R : STAR_R * 0.45;
          const a = rot + (i * Math.PI) / 5;
          const px = s.x + Math.cos(a) * rr;
          const py = s.y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,215,80,0.25)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, STAR_R + 7 + Math.sin(tick * 0.1) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // beacon - warm gold, matching the site accent
      const pulse = 1 + Math.sin(tick * 0.08) * 0.25;
      ctx.strokeStyle = "rgba(232,194,104,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hole.beacon.x, hole.beacon.y, BEACON_R * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(232,194,104,0.3)";
      ctx.beginPath();
      ctx.arc(hole.beacon.x, hole.beacon.y, BEACON_R * pulse + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#e8c268";
      ctx.beginPath();
      ctx.arc(hole.beacon.x, hole.beacon.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // trail
      const trail = trailRef.current;
      if (trail.length > 1) {
        ctx.strokeStyle = "rgba(246,241,231,0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (const t of trail) ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }

      // particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 0.025;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `hsla(${p.hue} 55% 60% / ${p.life})`;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }

      // aim preview + the closing ring (release before it shuts or the shot is spent)
      if (statusRef.current === "aiming" && aimRef.current) {
        const aimWindow = aimTimeFor(modeRef.current, holeIdxRef.current);
        const frac = Math.max(0, 1 - (performance.now() - aimStartRef.current) / (aimWindow * 1000));
        if (frac <= 0) {
          // hesitated too long - the window closes and the chance is gone
          aimRef.current = null;
          blip(140, 0.25, "sawtooth", 0.08);
          shakeRef.current = 6;
          if (modeRef.current === "endless") {
            fuelRef.current -= 1;
            setFuel(fuelRef.current);
            if (fuelRef.current <= 0) {
              if (clearedRef.current > readOrbitEndlessBest()) {
                try {
                  window.localStorage.setItem("gd:orbit:endless-best", String(clearedRef.current));
                  reportEndlessBest("orbit", clearedRef.current);
                } catch {}
                setEndlessBest(clearedRef.current);
              }
              setStatusBoth("runOver");
            } else {
              setStatusBoth("idle");
            }
          } else {
            holeLaunchesRef.current += 1;
            setHoleLaunches(holeLaunchesRef.current);
            setStatusBoth("idle");
          }
          raf = requestAnimationFrame(draw);
          return;
        }
        // shrinking ring around the probe: green when fresh, red when nearly shut
        const ringR = 12 + frac * 44;
        ctx.strokeStyle = `hsla(${Math.round(frac * 130)} 75% 55% / 0.9)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hole.start.x, hole.start.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `hsla(${Math.round(frac * 130)} 75% 55% / 0.22)`;
        ctx.beginPath();
        ctx.arc(hole.start.x, hole.start.y, ringR + 6, 0, Math.PI * 2);
        ctx.stroke();

        const { start, cur } = aimRef.current;
        const { vx, vy, power } = launchVelocity(start, cur);
        if (Math.hypot(vx, vy) >= 0.8) {
          const pts = previewPath(hole.start, vx, vy, hole);
          ctx.fillStyle = "rgba(255,220,120,0.9)";
          pts.forEach((p, i) => {
            if (i % 4 !== 0) return;
            const a = 1 - i / pts.length;
            ctx.globalAlpha = 0.25 + a * 0.55;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
          ctx.strokeStyle = `rgba(255,${Math.round(220 - power * 140)},100,0.9)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(hole.start.x, hole.start.y, 14 + power * 10, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
          ctx.stroke();
        }
      }

      // probe
      const probe = probeRef.current;
      const inFlight = statusRef.current === "flying" || statusRef.current === "resetting";
      const px = inFlight ? probe.x : hole.start.x;
      const py = inFlight ? probe.y : hole.start.y;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", applyOrientation);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalLaunches = totals.reduce((a, b) => a + (b || 0), 0);
  const starCount = starsWon.filter(Boolean).length;

  // persist once the full course is done
  useEffect(() => {
    if (status !== "courseDone") return;
    saveResult("orbit", dayRef.current, { score: totalLaunches, won: true });
    setStreak(getStreak("orbit", dayRef.current));
  }, [status, totalLaunches]);

  const share = async () => {
    // one line per hole: launches as rockets, star if snagged, beacon at the end
    const holeLines = totals.map((l, i) => {
      const rockets = "🚀".repeat(Math.min(l ?? 0, 5)) + ((l ?? 0) > 5 ? `+${(l ?? 0) - 5}` : "");
      return `${rockets}${starsWon[i] ? "⭐" : ""}🎯`;
    });
    const text = buildShare("ORBIT", num, [...holeLines, `⛳ ${totalLaunches} launches`], challengeUrl(totalLaunches));
    const outcome = await shareResult(text, {
      game: "ORBIT",
      num,
      emoji: "🪐",
      accent: "#9d8cff",
      headline: `${totalLaunches} launches`,
      lines: holeLines,
      streak,
    });
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const restartCourse = () => {
    setTotals([]);
    setStarsWon([]);
    loadHole(0);
  };

  const prior = typeof window !== "undefined" ? loadResult("orbit", dayRef.current) : null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <ModeSwitch endless={mode === "endless"} onDaily={backToDaily} onEndless={startEndless} />
      <div className="stat-bar shrink-0">
        {mode === "daily" ? (
          <>
            <div className="stat">
              <span className="lab">Hole</span>
              <span className="val">{holeIdx + 1}/{HOLES}</span>
            </div>
            <div className="stat">
              <span className="lab">Shots left</span>
              <span className={`val${DAILY_FUEL[holeIdx] - holeLaunches <= 2 ? " warn" : ""}`}>
                {Math.max(0, DAILY_FUEL[holeIdx] - holeLaunches)}
              </span>
            </div>
            <div className="stat">
              <span className="lab">Total</span>
              <span className="val">
                {totalLaunches + (status === "holeDone" || status === "courseDone" ? 0 : holeLaunches)}
              </span>
            </div>
            {prior?.won && (
              <div className="stat">
                <span className="lab">Best</span>
                <span className="val warn">{prior.score}</span>
              </div>
            )}
            <div className="stat">
              <span className="lab">Streak</span>
              <span className="val">{streak}🔥</span>
            </div>
          </>
        ) : (
          <>
            <div className="stat">
              <span className="lab">Hole</span>
              <span className="val">#{holeIdx + 1}</span>
            </div>
            <div className="stat">
              <span className="lab">Fuel</span>
              <span className={`val${fuel <= 2 ? " warn" : ""}`}>{fuel} ⛽</span>
            </div>
            <div className="stat">
              <span className="lab">Cleared</span>
              <span className="val">{cleared}</span>
            </div>
            <div className="stat">
              <span className="lab">Best run</span>
              <span className="val warn">{endlessBest}</span>
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board cursor-crosshair" />
      </div>
      <p className="hint shrink-0">
        drag anywhere · release <b>before the ring closes</b> or the shot is spent - it shrinks
        faster every hole · grab the ⭐ on the way · limited shots per hole - run dry and it&apos;s a
        bogey (+{BOGEY_PENALTY}) ·{" "}
        {mode === "daily" ? (
          <button onClick={startEndless}>endless mode →</button>
        ) : (
          <button onClick={backToDaily}>← back to daily</button>
        )}
        {" · "}
        <button onClick={() => setShowHelp(true)}>how to play?</button>
      </p>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
          <p className="text-slate-300 animate-pulse">Charting today&apos;s systems…</p>
        </div>
      )}

      {showHelp && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <button
              className="panel-x"
              aria-label="Close"
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:orbit:help", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. Drag anywhere and release</span> to launch
                your probe toward the golden beacon.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Gravity curves your shot.</span> Planets
                pull the probe, so sling around them - a straight line never reaches the beacon.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Release before the ring closes,</span> or
                the shot is spent. You get limited launches per hole, so aim deliberately.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Three holes a day.</span> Grab the star on
                the way for a bonus. Fewest total launches wins the bragging rights.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:orbit:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - to the launchpad
            </button>
            <GuideLink game="orbit" />
          </div>
        </div>
      )}

      {status === "holeDone" && (
        <Celebration
          title={mode === "endless" ? `Hole #${holeIdx + 1} cleared!` : `Hole ${holeIdx + 1} clear!`}
          stars={1 + (starsWon[holeIdx] ? 1 : 0) + ((totals[holeIdx] ?? 99) <= 2 ? 1 : 0)}
          score={
            mode === "endless"
              ? { label: "fuel in the tank", value: fuel }
              : { label: "launches", value: totals[holeIdx] ?? 0 }
          }
          badges={
            mode === "endless"
              ? [
                  starsWon[holeIdx] ? "+1 fuel for the ⭐" : "Star missed",
                  cleared >= endlessBest && cleared > 0 ? "Best run 🏆" : `Best: ${endlessBest}`,
                ]
              : [
                  starsWon[holeIdx] ? "Bonus star ⭐" : "Star missed",
                  ...((totals[holeIdx] ?? 99) === 1 ? ["Hole in one! 🎯"] : []),
                ]
          }
          primary={
            mode === "endless"
              ? {
                  label: `Hole #${holeIdx + 2} →`,
                  onClick: () => loadHoleDirect(endlessHole(runSeedRef.current, holeIdx + 1), holeIdx + 1),
                }
              : { label: `Hole ${holeIdx + 2} - it gets harder →`, onClick: () => loadHole(holeIdx + 1) }
          }
          footnote={mode === "endless" ? "Denser systems ahead. Spend fuel wisely." : "Same course for everyone today."}
        />
      )}

      {status === "runOver" && (
        <Celebration
          title="Out of fuel!"
          stars={cleared >= 9 ? 3 : cleared >= 5 ? 2 : cleared >= 2 ? 1 : 0}
          score={{ label: "holes cleared", value: cleared }}
          badges={[cleared >= endlessBest && cleared > 0 ? "New best! 🏆" : `Best run: ${endlessBest}`]}
          primary={{ label: "Run it back →", onClick: startEndless }}
          secondary={{ label: "← Daily", onClick: backToDaily }}
          footnote="Every launch costs fuel. Every beacon refills it."
        />
      )}

      {status === "courseDone" && (
        <Celebration
          title={`ORBIT #${num} complete!`}
          stars={starCount}
          score={{ label: "total launches", value: totalLaunches }}
          badges={[`${starCount}/3 bonus stars`, ...(totalLaunches <= 6 ? ["Ace pilot 🛰️"] : [])]}
          primary={{ label: copied ? "Shared ✓" : "Share result", onClick: share }}
          secondary={{ label: "Keep going ∞", onClick: startEndless }}
          pill={{ label: "Keep going ∞", onClick: startEndless }}
          footnote={
            endlessBest > 0
              ? `Your endless best: ${endlessBest} holes - beat it?`
              : "Endless mode has no bottom - how far can you go?"
          }
          countdown
          feedback="orbit"
        />
      )}
    </div>
  );
}
