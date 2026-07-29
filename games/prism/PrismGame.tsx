"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";

import {
  Cell,
  LEVELS,
  MirrorType,
  PrismLevel,
  TraceResult,
  endlessCfg,
  genLevel,
  genLevelFrom,
  isPlaceable,
  isSolved,
  starsFor,
  traceBeam,
} from "./engine";
import Celebration from "@/components/Celebration";
import GuideLink from "@/components/GuideLink";
import ModeSwitch from "@/components/ModeSwitch";
import { challengeNumber, todayKey } from "@/lib/sdk/daily";
import { reportEndlessBest } from "@/lib/sdk/leaderboard";
import { buildShare, challengeUrl, shareResult } from "@/lib/sdk/share";
import { blip, chirp } from "@/lib/sdk/sound";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { View, applyView, pointToGame } from "@/lib/sdk/viewport";

const CW = 900;
const CH = 600;
const BG = "#12151b";
const ACCENT = "#ff2d6f";

const ENDLESS_START_BANK = 6;
const ENDLESS_REFILL = 2;
const ENDLESS_BANK_CAP = 10;

type Phase = "play" | "levelClear" | "dayDone" | "roundClear" | "runOver";
type Mode = "daily" | "endless";

interface DayStat {
  mirrorsUsed: number;
  stars: number;
}

function readEndlessBest(): number {
  try {
    return Number(window.localStorage.getItem("gd:prism:endless-best") || 0);
  } catch {
    return 0;
  }
}

export default function PrismGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [mode, setMode] = useState<Mode>("daily");
  const [phase, setPhase] = useState<Phase>("play");
  const [levelIdx, setLevelIdx] = useState(0);
  const [mirrorsUsed, setMirrorsUsed] = useState(0);
  const [targetsHit, setTargetsHit] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [lastStars, setLastStars] = useState(1);
  const [cleared, setCleared] = useState(0);
  const [bank, setBank] = useState(ENDLESS_START_BANK);
  const [endlessBest, setEndlessBest] = useState(0);

  const levelRef = useRef<PrismLevel | null>(null);
  const mirrorsRef = useRef<Map<string, MirrorType>>(new Map());
  const traceRef = useRef<TraceResult | null>(null);
  const phaseRef = useRef<Phase>("play");
  const modeRef = useRef<Mode>("daily");
  const levelIdxRef = useRef(0);
  const statsRef = useRef<DayStat[]>([]);
  const clearedRef = useRef(0);
  const endlessBestRef = useRef(0);
  const bankRef = useRef(ENDLESS_START_BANK);
  const endlessSeedRef = useRef("");
  const portraitRef = useRef(false);
  const viewRef = useRef<View | null>(null);
  const dayRef = useRef("");

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const geom = (lv: PrismLevel) => {
    const cell = Math.min(Math.floor((CW - 24) / lv.cols), Math.floor((CH - 24) / lv.rows));
    return { cell, ox: (CW - cell * lv.cols) / 2, oy: (CH - cell * lv.rows) / 2 };
  };

  const syncMirrorState = () => {
    const lv = levelRef.current;
    if (!lv) return;
    const trace = traceBeam(lv, mirrorsRef.current);
    traceRef.current = trace;
    const used = mirrorsRef.current.size;
    setMirrorsUsed(used);
    setTargetsHit(trace.hitTargets.size);
    if (isSolved(lv, trace)) finishLevel(used);
  };

  const enterLevel = (lv: PrismLevel, idx: number) => {
    levelRef.current = lv;
    levelIdxRef.current = idx;
    mirrorsRef.current = new Map();
    const trace = traceBeam(lv, mirrorsRef.current);
    traceRef.current = trace;
    setLevelIdx(idx);
    setMirrorsUsed(0);
    // the straight beam can hit a target before any mirror is placed if one
    // happens to sit on the emitter's first run - reflect that immediately
    setTargetsHit(trace.hitTargets.size);
    setPhaseBoth("play");
  };

  const startLevel = (idx: number) => {
    modeRef.current = "daily";
    setMode("daily");
    enterLevel(genLevel(dayRef.current, idx), idx);
  };

  const loadEndlessRound = (i: number) => {
    const cfg = endlessCfg(i);
    if (bankRef.current < cfg.budget) {
      setPhaseBoth("runOver");
      return;
    }
    enterLevel(genLevelFrom(`prism:endless:${endlessSeedRef.current}:${i}`, cfg), i);
  };

  const startEndless = () => {
    modeRef.current = "endless";
    setMode("endless");
    clearedRef.current = 0;
    setCleared(0);
    bankRef.current = ENDLESS_START_BANK;
    setBank(ENDLESS_START_BANK);
    endlessSeedRef.current = Math.random().toString(36).slice(2, 9);
    blip(520, 0.09, "triangle", 0.06);
    loadEndlessRound(0);
  };

  const restartDay = () => {
    statsRef.current = [];
    setDayStats([]);
    startLevel(0);
  };

  const resetMirrors = () => {
    if (phaseRef.current !== "play") return;
    mirrorsRef.current = new Map();
    syncMirrorState();
    blip(260, 0.05, "sine", 0.035);
  };

  const finishLevel = (used: number) => {
    chirp(420, 880, 0.32, "triangle", 0.07);
    const lv = levelRef.current!;
    const stars = starsFor(used, lv.budget);
    setLastStars(stars);

    if (modeRef.current === "endless") {
      bankRef.current = Math.min(ENDLESS_BANK_CAP, bankRef.current - used + ENDLESS_REFILL);
      setBank(bankRef.current);
      clearedRef.current += 1;
      setCleared(clearedRef.current);
      if (clearedRef.current > endlessBestRef.current) {
        endlessBestRef.current = clearedRef.current;
        try {
          window.localStorage.setItem("gd:prism:endless-best", String(clearedRef.current));
        } catch {}
        setEndlessBest(clearedRef.current);
        reportEndlessBest("prism", clearedRef.current);
      }
      setPhaseBoth("roundClear");
      return;
    }

    statsRef.current = [...statsRef.current];
    statsRef.current[levelIdxRef.current] = { mirrorsUsed: used, stars };
    setDayStats([...statsRef.current]);
    if (levelIdxRef.current >= LEVELS.length - 1) {
      const total = statsRef.current.reduce((a, s) => a + (s?.mirrorsUsed || 0), 0);
      saveResult("prism", dayRef.current, { score: total, won: true }, false);
      setStreak(getStreak("prism", dayRef.current));
      setPhaseBoth("dayDone");
    } else {
      setPhaseBoth("levelClear");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(challengeNumber("prism"));
    setStreak(getStreak("prism", dayRef.current));
    const best = readEndlessBest();
    endlessBestRef.current = best;
    setEndlessBest(best);
    if (!window.localStorage.getItem("gd:prism:help")) setShowHelp(true);
    startLevel(0);

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

    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "play") return;
      const lv = levelRef.current;
      const hit = cellFromEvent(e);
      if (!lv || !hit) return;
      if (!isPlaceable(lv, hit.c, hit.r)) {
        blip(220, 0.06, "square", 0.04);
        return;
      }
      const key = `${hit.c},${hit.r}`;
      const existing = mirrorsRef.current.get(key);
      if (existing === undefined) {
        if (mirrorsRef.current.size >= lv.budget) {
          blip(170, 0.09, "square", 0.05);
          return;
        }
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
      const lv = levelRef.current;
      const view = applyView(canvas, ctx, CW, CH, portraitRef.current, BG);
      viewRef.current = view;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, CW, CH);

      if (!lv || !traceRef.current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const { cell, ox, oy } = geom(lv);
      const trace = traceRef.current;
      const solved = isSolved(lv, trace);

      ctx.strokeStyle = "rgba(238,240,245,0.06)";
      ctx.lineWidth = 1;
      for (let cc = 0; cc <= lv.cols; cc++) {
        ctx.beginPath();
        ctx.moveTo(ox + cc * cell, oy);
        ctx.lineTo(ox + cc * cell, oy + lv.rows * cell);
        ctx.stroke();
      }
      for (let rr = 0; rr <= lv.rows; rr++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + rr * cell);
        ctx.lineTo(ox + lv.cols * cell, oy + rr * cell);
        ctx.stroke();
      }

      for (let rr = 0; rr < lv.rows; rr++)
        for (let cc = 0; cc < lv.cols; cc++)
          if (lv.walls[rr][cc]) {
            ctx.fillStyle = "rgba(238,240,245,0.09)";
            ctx.beginPath();
            ctx.roundRect(ox + cc * cell + 3, oy + rr * cell + 3, cell - 6, cell - 6, 6);
            ctx.fill();
          }

      lv.targets.forEach((t, i) => {
        const x = ox + (t.c + 0.5) * cell;
        const y = oy + (t.r + 0.5) * cell;
        const hitIt = trace.hitTargets.has(i);
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.22, 0, Math.PI * 2);
        if (hitIt) {
          ctx.fillStyle = ACCENT + "30";
          ctx.fill();
        }
        ctx.strokeStyle = hitIt ? ACCENT : "rgba(238,240,245,0.32)";
        ctx.lineWidth = hitIt ? 3 : 2;
        ctx.stroke();
      });

      {
        const x = ox + (lv.receiver.c + 0.5) * cell;
        const y = oy + (lv.receiver.r + 0.5) * cell;
        const s = cell * 0.3;
        ctx.beginPath();
        ctx.roundRect(x - s, y - s, s * 2, s * 2, 8);
        ctx.fillStyle = solved ? "rgba(63,191,127,0.35)" : "rgba(238,240,245,0.1)";
        ctx.fill();
        ctx.strokeStyle = solved ? "#3fbf7f" : "rgba(238,240,245,0.3)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      {
        const x = ox + (lv.emitter.cell.c + 0.5) * cell;
        const y = oy + (lv.emitter.cell.r + 0.5) * cell;
        ctx.beginPath();
        ctx.arc(x, y, cell * 0.17, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
      }

      for (const [key, type] of mirrorsRef.current) {
        const [mc, mr] = key.split(",").map(Number);
        const x = ox + (mc + 0.5) * cell;
        const y = oy + (mr + 0.5) * cell;
        const s = cell * 0.3;
        ctx.strokeStyle = "#eef0f5";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (type === "/") {
          ctx.moveTo(x - s, y + s);
          ctx.lineTo(x + s, y - s);
        } else {
          ctx.moveTo(x - s, y - s);
          ctx.lineTo(x + s, y + s);
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
      trace.path.forEach((p, i) => {
        const x = ox + (p.c + 0.5) * cell;
        const y = oy + (p.r + 0.5) * cell;
        if (i === 0) ctx.moveTo(x, y);
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

  const cfg = mode === "endless" ? endlessCfg(levelIdx) : LEVELS[levelIdx];
  const totalMirrors = dayStats.reduce((a, s) => a + (s?.mirrorsUsed || 0), 0);
  const prior = typeof window !== "undefined" && dayRef.current ? loadResult("prism", dayRef.current) : null;

  const share = async () => {
    const lines = dayStats.map((s, i) => {
      const used = s?.mirrorsUsed ?? 0;
      const budget = LEVELS[i].budget;
      return "🪞".repeat(used) + "·".repeat(Math.max(0, budget - used));
    });
    const text = buildShare(
      "PRISM",
      num,
      [...lines, `${totalMirrors} mirror${totalMirrors === 1 ? "" : "s"} total`],
      challengeUrl(totalMirrors)
    );
    const outcome = await shareResult(text, {
      game: "PRISM",
      num,
      emoji: "🪞",
      accent: ACCENT,
      headline: `${totalMirrors} mirror${totalMirrors === 1 ? "" : "s"}`,
      lines,
      streak,
    });
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      <ModeSwitch endless={mode === "endless"} onDaily={() => startLevel(0)} onEndless={startEndless} />
      <div className="stat-bar shrink-0">
        <div className="stat">
          <span className="lab">{mode === "endless" ? "Round" : "Board"}</span>
          <span className="val">{mode === "endless" ? `#${levelIdx + 1}` : `${levelIdx + 1}/3`}</span>
        </div>
        <div className="stat">
          <span className="lab">Mirrors</span>
          <span className="val">
            {mirrorsUsed}/{cfg.budget}
          </span>
        </div>
        <div className="stat">
          <span className="lab">Targets</span>
          <span className="val">
            {targetsHit}/{cfg.targets}
          </span>
        </div>
        {mode === "endless" ? (
          <>
            <div className="stat">
              <span className="lab">Bank</span>
              <span className="val warn">{bank}</span>
            </div>
            <div className="stat">
              <span className="lab">Cleared</span>
              <span className="val">{cleared}</span>
            </div>
          </>
        ) : (
          <div className="stat">
            <span className="lab">Streak</span>
            <span className="val">{streak}🔥</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <canvas ref={canvasRef} className="board" />
      </div>

      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button onClick={resetMirrors} disabled={phase !== "play"} className="btn-line px-4 py-2 disabled:opacity-40">
          Reset
        </button>
      </div>
      <p className="hint">
        tap a cell to place a mirror · bend the beam through every target to the receiver ·{" "}
        <b>{cfg.budget} mirrors max</b> ·{" "}
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
                  window.localStorage.setItem("gd:prism:help", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. A laser fires from the emitter</span> and
                travels straight until it hits something.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Tap a cell to place a mirror.</span> Tap
                again to flip it, a third time to remove it. Bend the beam through every ring and
                into the glowing receiver.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. Mirrors are budgeted.</span> You can only
                have so many down at once - remove one to try a mirror somewhere else.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. The beam can&apos;t cross its own path.</span>{" "}
                Plan bends that don&apos;t double back on the line you&apos;ve already drawn. Fewer
                mirrors than the budget earns more stars.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:prism:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - bend the light
            </button>
            <GuideLink game="prism" />
          </div>
        </div>
      )}

      {phase === "levelClear" && (
        <Celebration
          title="Beam threaded!"
          stars={lastStars}
          score={{ label: "mirrors used", value: mirrorsUsed }}
          badges={[`budget was ${cfg.budget}`, ...(mirrorsUsed <= cfg.budget - 2 ? ["Minimalist ✨"] : [])]}
          primary={{ label: `Board ${levelIdx + 2} →`, onClick: () => startLevel(levelIdx + 1) }}
          footnote="Same boards for everyone today."
        />
      )}

      {phase === "roundClear" && (
        <Celebration
          title={`Board #${levelIdx + 1} cleared!`}
          stars={lastStars}
          score={{ label: "boards this run", value: cleared }}
          badges={[
            cleared > 0 && cleared >= endlessBest ? "Best run 🏆" : `Best: ${endlessBest}`,
            `Bank: ${bank} mirrors`,
          ]}
          primary={{ label: `Board #${levelIdx + 2} →`, onClick: () => loadEndlessRound(levelIdx + 1) }}
          secondary={{ label: "Stop the run", onClick: () => startLevel(0) }}
          footnote="The bank only refills a little each board - spend mirrors wisely."
        />
      )}

      {phase === "runOver" && (
        <Celebration
          title="Out of mirrors!"
          stars={cleared >= 8 ? 3 : cleared >= 4 ? 2 : cleared >= 1 ? 1 : 0}
          score={{ label: "boards cleared", value: cleared }}
          badges={[cleared >= endlessBest && cleared > 0 ? "New best! 🏆" : `Best run: ${endlessBest}`]}
          primary={{ label: "Run it back →", onClick: startEndless }}
          secondary={{ label: "← Daily", onClick: () => startLevel(0) }}
          footnote="The bank grows a little each board - spend fewer mirrors to save more."
        />
      )}

      {phase === "dayDone" && (
        <Celebration
          title={`PRISM #${num} complete!`}
          stars={Math.round(dayStats.reduce((a, s) => a + (s?.stars || 0), 0) / 3)}
          score={{ label: "total mirrors", value: totalMirrors }}
          badges={[
            `${LEVELS.reduce((a, l) => a + l.targets, 0)} targets hit`,
            ...(prior?.won ? [`Today's best: ${prior.score} mirrors`] : []),
          ]}
          primary={{ label: copied ? "Shared ✓" : "Share result", onClick: share }}
          secondary={{ label: "Keep going ∞", onClick: startEndless }}
          pill={{ label: "Keep going ∞", onClick: startEndless }}
          footnote={
            endlessBest > 0
              ? `Your endless best: ${endlessBest} boards - beat it?`
              : "Endless boards keep growing - how far can you bend the light?"
          }
          countdown
          feedback="prism"
        />
      )}
    </div>
  );
}
