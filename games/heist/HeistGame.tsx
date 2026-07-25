"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

import { useEffect, useRef, useState } from "react";
import { Cell, HeistCfg, HeistLevel, LEVELS, caughtAt, endlessCfg, genLevel, genLevelFrom, guardAt } from "./engine";
import { challengeNumber, todayKey } from "@/lib/sdk/daily";
import ModeSwitch from "@/components/ModeSwitch";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import GuideLink from "@/components/GuideLink";
import { reportEndlessBest } from "@/lib/sdk/leaderboard";
import { buildShare, challengeUrl, shareResult } from "@/lib/sdk/share";
import { blip, chirp } from "@/lib/sdk/sound";
import { View, applyView, pointToGame } from "@/lib/sdk/viewport";
import Celebration from "@/components/Celebration";

const CW = 900;
const CH = 600;
const TICK_MS = 240;

type Phase = "plan" | "run" | "caught" | "levelDone" | "dayDone";
type Mode = "daily" | "endless";

function readEndlessBest(): number {
  try {
    return Number(window.localStorage.getItem("gd:heist:endless-best") || 0);
  } catch {
    return 0;
  }
}

export default function HeistGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [levelIdx, setLevelIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("plan");
  const [mode, setMode] = useState<Mode>("daily");
  const [attempts, setAttempts] = useState(0);
  const [pathLen, setPathLen] = useState(1);
  const [canGo, setCanGo] = useState(false);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dayStats, setDayStats] = useState<{ gems: number; attempts: number; stars: number }[]>([]);
  const [cleared, setCleared] = useState(0); // endless: museums cleared this run
  const [endlessBest, setEndlessBest] = useState(0);
  const [lastStars, setLastStars] = useState(1);
  const [lastGems, setLastGems] = useState(0);

  const levelRef = useRef<HeistLevel | null>(null);
  const cfgRef = useRef<HeistCfg>(LEVELS[0]);
  const pathRef = useRef<Cell[]>([]);
  const phaseRef = useRef<Phase>("plan");
  const modeRef = useRef<Mode>("daily");
  const levelIdxRef = useRef(0);
  const attemptsRef = useRef(0);
  const clearedRef = useRef(0);
  const endlessSeedRef = useRef("");
  const runRef = useRef<{ t: number; lastTick: number; collected: Set<number> } | null>(null);
  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const dragRef = useRef(false);
  const dayRef = useRef("");
  const statsRef = useRef<{ gems: number; attempts: number; stars: number }[]>([]);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const geom = (lv: HeistLevel) => {
    const cell = Math.min(Math.floor((CW - 24) / lv.cols), Math.floor((CH - 24) / lv.rows));
    return { cell, ox: (CW - cell * lv.cols) / 2, oy: (CH - cell * lv.rows) / 2 };
  };

  const loadLevel = (lv: HeistLevel, cfg: HeistCfg, idx: number) => {
    levelRef.current = lv;
    cfgRef.current = cfg;
    levelIdxRef.current = idx;
    pathRef.current = [{ ...lv.start }];
    attemptsRef.current = 0;
    runRef.current = null;
    setLevelIdx(idx);
    setAttempts(0);
    setPathLen(1);
    setCanGo(false);
    setPhaseBoth("plan");
  };

  const startLevel = (idx: number) => {
    modeRef.current = "daily";
    setMode("daily");
    loadLevel(genLevel(dayRef.current, idx), LEVELS[idx], idx);
  };

  const startEndless = () => {
    modeRef.current = "endless";
    setMode("endless");
    clearedRef.current = 0;
    setCleared(0);
    endlessSeedRef.current = `heist:endless:${Math.random().toString(36).slice(2, 9)}`;
    const cfg = endlessCfg(0);
    loadLevel(genLevelFrom(`${endlessSeedRef.current}:0`, cfg), cfg, 0);
  };

  const nextEndless = () => {
    const i = levelIdxRef.current + 1;
    const cfg = endlessCfg(i);
    loadLevel(genLevelFrom(`${endlessSeedRef.current}:${i}`, cfg), cfg, i);
  };

  const syncPathState = () => {
    const lv = levelRef.current;
    const path = pathRef.current;
    setPathLen(path.length);
    // the vault is locked: GO only unlocks when the route grabs EVERY gem and ends on the exit
    const endsAtExit =
      !!lv && path.length > 1 && path[path.length - 1].c === lv.exit.c && path[path.length - 1].r === lv.exit.r;
    const allGems =
      !!lv && lv.gems.every((gm) => path.some((p) => p.c === gm.c && p.r === gm.r));
    setCanGo(endsAtExit && allGems);
  };

  const resetPath = () => {
    const lv = levelRef.current;
    if (!lv || phaseRef.current !== "plan") return;
    pathRef.current = [{ ...lv.start }];
    syncPathState();
  };

  const go = () => {
    if (phaseRef.current !== "plan" || !canGo) return;
    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    runRef.current = { t: 0, lastTick: performance.now(), collected: new Set() };
    blip(440, 0.09, "triangle", 0.06);
    setPhaseBoth("run");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(challengeNumber("heist"));
    setStreak(getStreak("heist", dayRef.current));
    setEndlessBest(readEndlessBest());
    startLevel(0);
    if (!window.localStorage.getItem("gd:heist:help")) setShowHelp(true);

    const mq = window.matchMedia("(orientation: portrait)");
    const applyOrientation = () => {
      portraitRef.current = mq.matches;
    };
    applyOrientation();
    mq.addEventListener("change", applyOrientation);

    const cellFromEvent = (e: PointerEvent): Cell | null => {
      const lv = levelRef.current;
      const v = viewRef.current;
      if (!lv || !v) return null;
      const { cell, ox, oy } = geom(lv);
      const { x, y } = pointToGame(v, canvas, e.clientX, e.clientY, CW);
      const c = Math.floor((x - ox) / cell);
      const r = Math.floor((y - oy) / cell);
      if (c < 0 || r < 0 || c >= lv.cols || r >= lv.rows) return null;
      return { c, r };
    };

    const tryExtend = (target: Cell | null) => {
      const lv = levelRef.current;
      if (!lv || !target || phaseRef.current !== "plan") return;
      if (lv.walls[target.r][target.c]) return;
      const path = pathRef.current;
      const head = path[path.length - 1];
      const dist = Math.abs(head.c - target.c) + Math.abs(head.r - target.r);
      if (dist !== 1) return;
      // each tile can be stepped on only once - no doubling back
      if (path.some((p) => p.c === target.c && p.r === target.r)) return;
      // the exit is a locked door until every gem is already on the route
      if (target.c === lv.exit.c && target.r === lv.exit.r) {
        const allGems = lv.gems.every((gm) => path.some((p) => p.c === gm.c && p.r === gm.r));
        if (!allGems) {
          blip(220, 0.08, "square", 0.05); // locked-door thunk
          return;
        }
      }
      path.push(target);
      syncPathState();
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = true;
      const cellHit = cellFromEvent(e);
      const path = pathRef.current;
      // tap the head to undo a step
      if (cellHit && path.length > 1) {
        const head = path[path.length - 1];
        if (cellHit.c === head.c && cellHit.r === head.r) {
          path.pop();
          syncPathState();
          return;
        }
      }
      tryExtend(cellHit);
    };
    const onMove = (e: PointerEvent) => {
      if (dragRef.current) tryExtend(cellFromEvent(e));
    };
    const onUp = () => {
      dragRef.current = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);

    let raf = 0;

    const finishLevel = (gems: number) => {
      // every escape now carries all gems - stars rate how few plans it took
      const stars = attemptsRef.current === 1 ? 3 : attemptsRef.current <= 3 ? 2 : 1;
      setLastStars(stars);
      setLastGems(gems);

      if (modeRef.current === "endless") {
        clearedRef.current += 1;
        setCleared(clearedRef.current);
        if (clearedRef.current > readEndlessBest()) {
          try {
            window.localStorage.setItem("gd:heist:endless-best", String(clearedRef.current));
            reportEndlessBest("heist", clearedRef.current);
          } catch {}
          setEndlessBest(clearedRef.current);
        }
        setPhaseBoth("levelDone");
        return;
      }

      statsRef.current = [...statsRef.current];
      statsRef.current[levelIdxRef.current] = { gems, attempts: attemptsRef.current, stars };
      setDayStats([...statsRef.current]);
      if (levelIdxRef.current >= LEVELS.length - 1) {
        const totalAttempts = statsRef.current.reduce((a, s) => a + (s?.attempts || 0), 0);
        saveResult("heist", dayRef.current, { score: totalAttempts, won: true });
        setStreak(getStreak("heist", dayRef.current));
        setPhaseBoth("dayDone");
      } else {
        setPhaseBoth("levelDone");
      }
    };

    const draw = (now: number) => {
      const lv = levelRef.current;
      if (!lv) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { cell, ox, oy } = geom(lv);
      const path = pathRef.current;
      const run = runRef.current;

      // ---- advance simulation ----
      if (phaseRef.current === "run" && run) {
        if (now - run.lastTick >= TICK_MS) {
          run.lastTick = now;
          run.t += 1;
          const t = run.t;
          if (t >= path.length) {
            // path exhausted - we're standing on the exit (GO required it)
            finishLevel(run.collected.size);
          } else {
            const oldPos = path[t - 1];
            const newPos = path[t];
            if (caughtAt(lv.guards, oldPos, newPos, t)) {
              chirp(520, 130, 0.38, "sawtooth", 0.08);
              setPhaseBoth("caught");
              window.setTimeout(() => {
                if (phaseRef.current === "caught") {
                  runRef.current = null;
                  setPhaseBoth("plan");
                }
              }, 900);
            } else {
              lv.gems.forEach((gm, i) => {
                if (gm.c === newPos.c && gm.r === newPos.r) {
                  run.collected.add(i);
                  blip(880, 0.11, "triangle", 0.07);
                }
              });
              if (newPos.c === lv.exit.c && newPos.r === lv.exit.r) finishLevel(run.collected.size);
            }
          }
        }
      }

      // ---- render ----
      const frac = run ? Math.min(1, (now - run.lastTick) / TICK_MS) : 0;
      const tNow = run ? run.t : path.length - 1; // planning: preview guards at plan-head time

      viewRef.current = applyView(canvas, ctx, CW, CH, portraitRef.current, "#efe8db");
      ctx.fillStyle = "#efe8db";
      ctx.fillRect(0, 0, CW, CH);

      // floor grid
      ctx.strokeStyle = "rgba(41,36,32,0.07)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= lv.cols; c++) {
        ctx.beginPath();
        ctx.moveTo(ox + c * cell, oy);
        ctx.lineTo(ox + c * cell, oy + lv.rows * cell);
        ctx.stroke();
      }
      for (let r = 0; r <= lv.rows; r++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + r * cell);
        ctx.lineTo(ox + lv.cols * cell, oy + r * cell);
        ctx.stroke();
      }

      // patrol loops (faint dotted)
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(201,111,74,0.3)";
      ctx.lineWidth = 1.5;
      for (const g of lv.guards) {
        ctx.beginPath();
        g.path.forEach((p, i) => {
          const x = ox + (p.c + 0.5) * cell;
          const y = oy + (p.r + 0.5) * cell;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // walls (display cases)
      for (let r = 0; r < lv.rows; r++)
        for (let c = 0; c < lv.cols; c++)
          if (lv.walls[r][c]) {
            ctx.fillStyle = "#3a332c";
            ctx.beginPath();
            ctx.roundRect(ox + c * cell + 3, oy + r * cell + 3, cell - 6, cell - 6, 6);
            ctx.fill();
          }

      // exit
      ctx.fillStyle = "rgba(232,194,104,0.5)";
      ctx.beginPath();
      ctx.roundRect(ox + lv.exit.c * cell + 2, oy + lv.exit.r * cell + 2, cell - 4, cell - 4, 8);
      ctx.fill();
      ctx.fillStyle = "#8a6d2f";
      ctx.font = `bold ${Math.floor(cell * 0.24)}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(ox + (lv.exit.c + 0.5) * cell, oy + (lv.exit.r + 0.5) * cell);
      if (portraitRef.current) ctx.rotate(Math.PI / 2); // keep the label upright when rotated
      ctx.fillText("EXIT", 0, cell * 0.1);
      ctx.restore();

      // planned path
      ctx.fillStyle = "rgba(41,36,32,0.4)";
      path.forEach((p, i) => {
        if (i === 0) return;
        const x = ox + (p.c + 0.5) * cell;
        const y = oy + (p.r + 0.5) * cell;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
      if (path.length > 1 && phaseRef.current === "plan") {
        const head = path[path.length - 1];
        ctx.strokeStyle = "rgba(41,36,32,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ox + (head.c + 0.5) * cell, oy + (head.r + 0.5) * cell, cell * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // gems
      lv.gems.forEach((gm, i) => {
        if (run?.collected.has(i)) return;
        const x = ox + (gm.c + 0.5) * cell;
        const y = oy + (gm.r + 0.5) * cell;
        const s = cell * 0.22;
        ctx.fillStyle = "#d9a441";
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(41,36,32,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // characters are drawn as emoji - instantly readable, no legend needed;
      // counter-rotated so they stay upright when the board rotates on phones
      const glyph = (txt: string, x: number, y: number, size: number, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        if (portraitRef.current) ctx.rotate(Math.PI / 2);
        ctx.font = `${Math.round(size)}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      };

      // guards 👮: live position (interpolated during run) + planning ghost at plan-head time
      for (const g of lv.guards) {
        let gx: number;
        let gy: number;
        if (phaseRef.current === "run" && run) {
          const a = guardAt(g, run.t);
          const b = guardAt(g, run.t + 1);
          gx = ox + (a.c + (b.c - a.c) * frac + 0.5) * cell;
          gy = oy + (a.r + (b.r - a.r) * frac + 0.5) * cell;
        } else {
          const a = guardAt(g, 0);
          gx = ox + (a.c + 0.5) * cell;
          gy = oy + (a.r + 0.5) * cell;
        }
        glyph("👮", gx, gy, cell * 0.72);

        // ghost: where this guard will be when your plan reaches its current length
        if (phaseRef.current === "plan" && path.length > 1) {
          const gh = guardAt(g, tNow);
          const hx = ox + (gh.c + 0.5) * cell;
          const hy = oy + (gh.r + 0.5) * cell;
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "rgba(201,111,74,0.75)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(hx, hy, cell * 0.32, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          glyph("👮", hx, hy, cell * 0.55, 0.4);
        }
      }

      // your thief 🥷
      let tx: number;
      let ty: number;
      if (phaseRef.current === "run" && run && run.t < path.length) {
        const a = path[Math.max(0, run.t - 1)];
        const b = path[Math.min(path.length - 1, run.t)];
        tx = ox + (a.c + (b.c - a.c) * frac + 0.5) * cell;
        ty = oy + (a.r + (b.r - a.r) * frac + 0.5) * cell;
      } else {
        const a = phaseRef.current === "plan" ? path[0] : path[path.length - 1];
        tx = ox + (a.c + 0.5) * cell;
        ty = oy + (a.r + 0.5) * cell;
      }
      glyph("🥷", tx, ty, cell * 0.74);

      if (phaseRef.current === "caught") {
        ctx.fillStyle = "rgba(201,111,74,0.25)";
        ctx.fillRect(0, 0, CW, CH);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cfg = mode === "endless" ? endlessCfg(levelIdx) : LEVELS[levelIdx];
  const totalAttempts = dayStats.reduce((a, s) => a + (s?.attempts || 0), 0);
  const totalGems = dayStats.reduce((a, s) => a + (s?.gems || 0), 0);
  const maxGems = LEVELS.reduce((a, l) => a + l.gems, 0);
  const prior = typeof window !== "undefined" && dayRef.current ? loadResult("heist", dayRef.current) : null;

  const share = async () => {
    // one line per museum: gems taken vs left behind, plans spent
    const lines = dayStats.map((s, i) => {
      const got = s?.gems ?? 0;
      const max = LEVELS[i].gems;
      return `${"💎".repeat(got)}${"◇".repeat(Math.max(0, max - got))} 🕶️${s?.attempts ?? 0}`;
    });
    const text = buildShare("HEIST", num, [
      ...lines,
      `${totalAttempts} plan${totalAttempts === 1 ? "" : "s"} · the perfect crime?`,
    ], challengeUrl(totalAttempts));
    const outcome = await shareResult(text, {
      game: "HEIST",
      num,
      emoji: "💎",
      accent: "#3fbf7f",
      headline: `${totalAttempts} plan${totalAttempts === 1 ? "" : "s"}`,
      lines,
      streak,
    });
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const restartDay = () => {
    statsRef.current = [];
    setDayStats([]);
    startLevel(0);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      <ModeSwitch endless={mode === "endless"} onDaily={() => startLevel(0)} onEndless={startEndless} />
      <div className="stat-bar shrink-0">
        <div className="stat">
          <span className="lab">Museum</span>
          <span className="val">{mode === "endless" ? `#${levelIdx + 1}` : `${levelIdx + 1}/3`}</span>
        </div>
        <div className="stat">
          <span className="lab">Guards</span>
          <span className="val">{cfg.guards}</span>
        </div>
        <div className="stat">
          <span className="lab">Plans</span>
          <span className="val">{attempts}</span>
        </div>
        <div className="stat">
          <span className="lab">Steps</span>
          <span className="val">{pathLen - 1}</span>
        </div>
        {mode === "endless" ? (
          <>
            <div className="stat">
              <span className="lab">Cleared</span>
              <span className="val">{cleared}</span>
            </div>
            <div className="stat">
              <span className="lab">Best run</span>
              <span className="val warn">{endlessBest}</span>
            </div>
          </>
        ) : (
          <>
            <div className="stat">
              <span className="lab">Streak</span>
              <span className="val">{streak}🔥</span>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
      </div>

      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button onClick={resetPath} disabled={phase !== "plan"} className="btn-line px-4 py-2 disabled:opacity-40">
          Reset
        </button>
        <button onClick={go} disabled={!canGo || phase !== "plan"} className="btn-ink px-7 py-2 disabled:opacity-40">
          GO 🕶️
        </button>
      </div>
      <p className="hint">
        you are 🥷 · grab <b>every</b> 🔶 then reach the EXIT · each tile only <b>once</b>, no
        doubling back · faint 👮 = where guards will be at your plan&apos;s last step ·{" "}
        {mode === "daily" ? (
          <button onClick={startEndless}>endless mode →</button>
        ) : (
          <button onClick={() => startLevel(0)}>← back to daily</button>
        )}{" "}
        · <button onClick={() => setShowHelp(true)}>how to play?</button>
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
                  window.localStorage.setItem("gd:heist:help", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. You are the ninja 🥷 - plan the whole robbery first.</span>{" "}
                Drag (or tap cell by cell) from your 🥷 to the EXIT - through the gems 🔶 if you dare.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Guards 👮 patrol the dotted loops</span> -
                one step for every step you take. The{" "}
                <span className="tx-ink font-semibold">dashed ghost</span> shows where each guard
                will be at your plan&apos;s final step. Tap your path&apos;s head to undo.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Press GO and pray.</span> No control
                once it starts. Same cell as a guard = caught = replan.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. The vault is locked.</span> Your route
                must collect <b>every gem</b> before the exit opens, and{" "}
                <b>each tile can be stepped on only once</b> - no doubling back to wait out
                guards. Fewest plans = the perfect crime.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:heist:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - case the joint
            </button>
            <GuideLink game="heist" />
          </div>
        </div>
      )}

      {phase === "levelDone" && mode === "daily" && (
        <Celebration
          title="Clean getaway!"
          stars={lastStars}
          score={{ label: "gems secured", value: lastGems }}
          badges={[
            `${dayStats[levelIdx]?.attempts || 1} plan${(dayStats[levelIdx]?.attempts || 1) === 1 ? " - first try ✓" : "s"}`,
            lastGems >= cfg.gems ? "Every gem 💎" : `${lastGems}/${cfg.gems} gems`,
          ]}
          primary={{ label: `Museum ${levelIdx + 2} - more guards →`, onClick: () => startLevel(levelIdx + 1) }}
          footnote="Same museums for everyone today."
        />
      )}

      {phase === "levelDone" && mode === "endless" && (
        <Celebration
          title={`Museum #${levelIdx + 1} cleared!`}
          stars={lastStars}
          score={{ label: "museums this run", value: cleared }}
          badges={[
            cleared > 0 && cleared >= endlessBest ? "Best run 🏆" : `Best: ${endlessBest}`,
            `Next: ${endlessCfg(levelIdx + 1).guards} guards`,
          ]}
          primary={{ label: `Museum #${levelIdx + 2} →`, onClick: nextEndless }}
          secondary={{ label: "Stop the run", onClick: () => startLevel(0) }}
          footnote="It only gets meaner from here."
        />
      )}

      {phase === "dayDone" && (
        <Celebration
          title={`HEIST #${num} complete!`}
          stars={Math.round(dayStats.reduce((a, s) => a + (s?.stars || 0), 0) / 3)}
          score={{ label: `gems of ${maxGems}`, value: totalGems }}
          badges={[
            `${totalAttempts} plan${totalAttempts === 1 ? "" : "s"} total`,
            ...(prior?.won ? [`Today's best: ${prior.score} plans`] : []),
          ]}
          primary={{ label: copied ? "Shared ✓" : "Share result", onClick: share }}
          secondary={{ label: "Keep going ∞", onClick: startEndless }}
          pill={{ label: "Keep going ∞", onClick: startEndless }}
          footnote={
            endlessBest > 0
              ? `Your endless best: ${endlessBest} museums - beat it?`
              : "Endless museums keep growing - how deep can you go?"
          }
          countdown
          feedback="heist"
        />
      )}
    </div>
  );
}
