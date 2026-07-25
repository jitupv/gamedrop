"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";

import {
  DAILY_LEN,
  DAILY_PALETTE,
  Feedback,
  MAX_GUESSES,
  SYMBOLS,
  dailyCode,
  endlessCode,
  isCracked,
  judge,
  roundCfg,
  shareRow,
  starsFor,
} from "./engine";
import Celebration from "@/components/Celebration";
import Countdown from "@/components/Countdown";
import GuideLink from "@/components/GuideLink";
import ModeSwitch from "@/components/ModeSwitch";
import PuzzleRating from "@/components/PuzzleRating";
import { challengeNumber, todayKey } from "@/lib/sdk/daily";
import { reportEndlessBest } from "@/lib/sdk/leaderboard";
import { buildShare, challengeUrl, shareResult } from "@/lib/sdk/share";
import { blip, chirp } from "@/lib/sdk/sound";
import { getStreak, loadResult, saveResult } from "@/lib/sdk/storage";
import { applyView, pointToGame } from "@/lib/sdk/viewport";

// logical world - portrait, never rotated (fits phones as-is, letterboxes on desktop)
const W = 560;
const H = 800;
const BG = "#12151b";

// board metrics
const SLOT = 52;
const GAP = 10;
const ROW_TOP = 26;
const ROW_H = 66;
const PAL_Y = ROW_TOP + MAX_GUESSES * ROW_H + 30; // palette row baseline
const BTN_R = 27;
const CTRL_Y = PAL_Y + 86; // backspace / GO row

type Phase = "play" | "dayDone" | "dayFail" | "roundClear" | "runOver";
type Mode = "daily" | "endless";

interface Row {
  guess: number[];
  fb: Feedback;
}

// draw one symbol: filled shape on a soft disc, readable at small sizes
function drawSymbol(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, r: number) {
  const { color, shape } = SYMBOLS[id];
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(x, y - r * 0.66);
      ctx.lineTo(x + r * 0.62, y + r * 0.5);
      ctx.lineTo(x - r * 0.62, y + r * 0.5);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(x - r * 0.52, y - r * 0.52, r * 1.04, r * 1.04);
      break;
    case "diamond":
      ctx.moveTo(x, y - r * 0.68);
      ctx.lineTo(x + r * 0.55, y);
      ctx.lineTo(x, y + r * 0.68);
      ctx.lineTo(x - r * 0.55, y);
      ctx.closePath();
      break;
    case "star": {
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r * 0.68 : r * 0.3;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "cross": {
      const a = r * 0.24;
      const b = r * 0.62;
      ctx.moveTo(x - a, y - b);
      ctx.lineTo(x + a, y - b);
      ctx.lineTo(x + a, y - a);
      ctx.lineTo(x + b, y - a);
      ctx.lineTo(x + b, y + a);
      ctx.lineTo(x + a, y + a);
      ctx.lineTo(x + a, y + b);
      ctx.lineTo(x - a, y + b);
      ctx.lineTo(x - a, y + a);
      ctx.lineTo(x - b, y + a);
      ctx.lineTo(x - b, y - a);
      ctx.lineTo(x - a, y - a);
      ctx.closePath();
      break;
    }
    case "moon":
      ctx.arc(x, y, r * 0.62, Math.PI * 0.25, Math.PI * 1.75);
      ctx.arc(x + r * 0.34, y, r * 0.46, Math.PI * 1.6, Math.PI * 0.4, true);
      ctx.closePath();
      break;
    case "hex": {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * r * 0.64;
        const py = y + Math.sin(a) * r * 0.64;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
}

export default function GlyphGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [num, setNum] = useState(0);
  const [mode, setMode] = useState<Mode>("daily");
  const [phase, setPhase] = useState<Phase>("play");
  const [guessCount, setGuessCount] = useState(0);
  const [cracked, setCracked] = useState(0);
  const [endlessBest, setEndlessBest] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dailyGuesses, setDailyGuesses] = useState(0); // final result for panels

  const modeRef = useRef<Mode>("daily");
  const phaseRef = useRef<Phase>("play");
  const codeRef = useRef<number[]>([]);
  const rowsRef = useRef<Row[]>([]);
  const currentRef = useRef<number[]>([]);
  const paletteRef = useRef(DAILY_PALETTE);
  const lenRef = useRef(DAILY_LEN);
  const roundRef = useRef(0);
  const crackedRef = useRef(0);
  const runSeedRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const dayRef = useRef("");
  const crackedBestRef = useRef(0);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const persistBoard = () => {
    if (modeRef.current !== "daily") return;
    try {
      window.localStorage.setItem(
        `gd:glyph:board:${dayRef.current}`,
        JSON.stringify(rowsRef.current.map((r) => r.guess))
      );
    } catch {}
  };

  const loadDaily = () => {
    modeRef.current = "daily";
    setMode("daily");
    lenRef.current = DAILY_LEN;
    paletteRef.current = DAILY_PALETTE;
    codeRef.current = dailyCode(dayRef.current);
    currentRef.current = [];
    rowsRef.current = [];
    // restore today's board (page refreshes mid-game keep progress)
    try {
      const raw = window.localStorage.getItem(`gd:glyph:board:${dayRef.current}`);
      if (raw) {
        const guesses: number[][] = JSON.parse(raw);
        rowsRef.current = guesses.map((g) => ({ guess: g, fb: judge(codeRef.current, g) }));
      }
    } catch {}
    setGuessCount(rowsRef.current.length);
    const done = rowsRef.current.some((r) => r.fb.exact === lenRef.current);
    if (done) {
      setDailyGuesses(rowsRef.current.length);
      setPhaseBoth("dayDone");
    } else if (rowsRef.current.length >= MAX_GUESSES) {
      setPhaseBoth("dayFail");
    } else {
      setPhaseBoth("play");
    }
  };

  const startEndless = () => {
    modeRef.current = "endless";
    setMode("endless");
    runSeedRef.current = Math.floor(Math.random() * 1e9);
    roundRef.current = 0;
    crackedRef.current = 0;
    setCracked(0);
    nextEndlessRound();
    blip(520, 0.09, "triangle", 0.06);
  };

  const nextEndlessRound = () => {
    const cfg = roundCfg(roundRef.current);
    lenRef.current = cfg.len;
    paletteRef.current = cfg.palette;
    codeRef.current = endlessCode(runSeedRef.current, roundRef.current);
    rowsRef.current = [];
    currentRef.current = [];
    setGuessCount(0);
    setPhaseBoth("play");
  };

  const submit = () => {
    if (phaseRef.current !== "play") return;
    if (currentRef.current.length < lenRef.current) {
      shakeRef.current = 10;
      blip(180, 0.08, "square", 0.05);
      return;
    }
    const guess = [...currentRef.current];
    const fb = judge(codeRef.current, guess);
    rowsRef.current.push({ guess, fb });
    currentRef.current = [];
    setGuessCount(rowsRef.current.length);
    flashRef.current = 1;
    persistBoard();

    if (isCracked(codeRef.current, guess)) {
      chirp(420, 880, 0.35, "triangle", 0.08);
      if (modeRef.current === "daily") {
        const used = rowsRef.current.length;
        setDailyGuesses(used);
        saveResult("glyph", dayRef.current, { score: used, won: true }, false);
        setStreak(getStreak("glyph", dayRef.current));
        setPhaseBoth("dayDone");
      } else {
        crackedRef.current += 1;
        setCracked(crackedRef.current);
        setPhaseBoth("roundClear");
      }
      return;
    }

    blip(fb.exact > 0 ? 560 : 320, 0.07, "triangle", 0.05);

    if (rowsRef.current.length >= MAX_GUESSES) {
      chirp(320, 90, 0.45, "sawtooth", 0.09);
      if (modeRef.current === "daily") {
        saveResult("glyph", dayRef.current, { score: MAX_GUESSES, won: false }, false);
        setPhaseBoth("dayFail");
      } else {
        if (crackedRef.current > crackedBestRef.current) {
          crackedBestRef.current = crackedRef.current;
          setEndlessBest(crackedRef.current);
          try {
            window.localStorage.setItem("gd:glyph:endless-best", String(crackedRef.current));
          } catch {}
          reportEndlessBest("glyph", crackedRef.current);
        }
        setPhaseBoth("runOver");
      }
    }
  };

  const tapSymbol = (id: number) => {
    if (phaseRef.current !== "play") return;
    if (currentRef.current.length >= lenRef.current) return;
    currentRef.current = [...currentRef.current, id];
    blip(440 + id * 40, 0.05, "sine", 0.04);
  };

  const backspace = () => {
    if (phaseRef.current !== "play") return;
    currentRef.current = currentRef.current.slice(0, -1);
    blip(260, 0.05, "sine", 0.035);
  };

  // ---- layout helpers (logical coords) ----
  const rowX = (len: number) => (W - (len * SLOT + (len - 1) * GAP) - 92) / 2; // 92 = feedback pegs area
  const palX = (palette: number) => (W - (palette * (BTN_R * 2 + 10) - 10)) / 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dayRef.current = todayKey();
    setNum(challengeNumber("glyph"));
    setStreak(getStreak("glyph", dayRef.current));
    try {
      const b = Number(window.localStorage.getItem("gd:glyph:endless-best") || 0);
      crackedBestRef.current = b;
      setEndlessBest(b);
    } catch {}
    if (!window.localStorage.getItem("gd:glyph:help")) setShowHelp(true);
    loadDaily();

    const onDown = (e: PointerEvent) => {
      if (phaseRef.current !== "play") return;
      const v = viewRef.current;
      if (!v) return;
      const { x, y } = pointToGame(v, canvas, e.clientX, e.clientY, W);
      const len = lenRef.current;
      const palette = paletteRef.current;

      // palette buttons
      const px0 = palX(palette);
      for (let i = 0; i < palette; i++) {
        const cx = px0 + i * (BTN_R * 2 + 10) + BTN_R;
        if ((x - cx) ** 2 + (y - PAL_Y) ** 2 <= (BTN_R + 6) ** 2) {
          tapSymbol(i);
          return;
        }
      }
      // controls: backspace (left) and GO (right)
      if (y > CTRL_Y - 30 && y < CTRL_Y + 30) {
        if (x > W / 2 - 150 && x < W / 2 - 30) {
          backspace();
          return;
        }
        if (x > W / 2 - 10 && x < W / 2 + 150) {
          submit();
          return;
        }
      }
      // tap the active row to clear the last pick (mobile-friendly undo)
      const activeY = ROW_TOP + rowsRef.current.length * ROW_H + SLOT / 2;
      if (Math.abs(y - activeY) < SLOT / 2 && rowsRef.current.length < MAX_GUESSES) backspace();
    };
    canvas.addEventListener("pointerdown", onDown);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") submit();
      if (e.key === "Backspace") backspace();
      const n = Number(e.key);
      if (n >= 1 && n <= paletteRef.current) tapSymbol(n - 1);
    };
    window.addEventListener("keydown", onKey);

    let raf = 0;
    const draw = () => {
      const view = applyView(canvas, ctx, W, H, false, BG);
      viewRef.current = view;

      if (shakeRef.current > 0) {
        shakeRef.current *= 0.84;
        if (shakeRef.current < 0.3) shakeRef.current = 0;
        ctx.translate((Math.random() - 0.5) * shakeRef.current, 0);
      }
      if (flashRef.current > 0) flashRef.current *= 0.92;

      ctx.fillStyle = BG;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      const len = lenRef.current;
      const palette = paletteRef.current;
      const x0 = rowX(len);

      // guess rows
      for (let r = 0; r < MAX_GUESSES; r++) {
        const y = ROW_TOP + r * ROW_H + SLOT / 2;
        const row = rowsRef.current[r];
        const isActive = r === rowsRef.current.length && phaseRef.current === "play";

        for (let i = 0; i < len; i++) {
          const x = x0 + i * (SLOT + GAP) + SLOT / 2;
          ctx.beginPath();
          ctx.roundRect(x - SLOT / 2, y - SLOT / 2, SLOT, SLOT, 12);
          ctx.fillStyle = isActive ? "rgba(238,240,245,0.08)" : "rgba(238,240,245,0.04)";
          ctx.fill();
          ctx.lineWidth = isActive ? 2 : 1;
          ctx.strokeStyle = isActive ? "rgba(238,240,245,0.35)" : "rgba(238,240,245,0.12)";
          ctx.stroke();

          const sym = row ? row.guess[i] : isActive ? currentRef.current[i] : undefined;
          if (sym !== undefined) drawSymbol(ctx, sym, x, y, SLOT / 2);
        }

        // feedback pegs: green = right slot, amber ring = wrong slot
        if (row) {
          const pegX = x0 + len * (SLOT + GAP) + 14;
          for (let p = 0; p < len; p++) {
            const px = pegX + (p % 2) * 18;
            const py = y - 14 + Math.floor(p / 2) * 18;
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            if (p < row.fb.exact) {
              ctx.fillStyle = "#3fbf7f";
              ctx.fill();
            } else if (p < row.fb.exact + row.fb.misplaced) {
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = "#e6c26b";
              ctx.stroke();
            } else {
              ctx.fillStyle = "rgba(238,240,245,0.1)";
              ctx.fill();
            }
          }
        }
      }

      if (phaseRef.current === "play") {
        // palette
        const px0 = palX(palette);
        for (let i = 0; i < palette; i++) {
          const cx = px0 + i * (BTN_R * 2 + 10) + BTN_R;
          ctx.beginPath();
          ctx.arc(cx, PAL_Y, BTN_R, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(238,240,245,0.07)";
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(238,240,245,0.18)";
          ctx.stroke();
          drawSymbol(ctx, i, cx, PAL_Y, BTN_R * 0.92);
        }

        // controls
        ctx.font = "bold 20px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.beginPath();
        ctx.roundRect(W / 2 - 150, CTRL_Y - 26, 120, 52, 26);
        ctx.fillStyle = "rgba(238,240,245,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(238,240,245,0.2)";
        ctx.stroke();
        ctx.fillStyle = "rgba(238,240,245,0.75)";
        ctx.fillText("⌫", W / 2 - 90, CTRL_Y + 1);

        const ready = currentRef.current.length === lenRef.current;
        ctx.beginPath();
        ctx.roundRect(W / 2 - 10, CTRL_Y - 26, 160, 52, 26);
        ctx.fillStyle = ready ? "#e6c26b" : "rgba(238,240,245,0.08)";
        ctx.fill();
        if (!ready) {
          ctx.strokeStyle = "rgba(238,240,245,0.2)";
          ctx.stroke();
        }
        ctx.fillStyle = ready ? "#14161c" : "rgba(238,240,245,0.4)";
        ctx.fillText("GO", W / 2 + 70, CTRL_Y + 1);
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

  const viewRef = useRef<ReturnType<typeof applyView> | null>(null);

  const share = async () => {
    const rows = rowsRef.current.map((r) => shareRow(DAILY_LEN, r.fb));
    const won = phase === "dayDone";
    const headline = won ? `Cracked in ${dailyGuesses}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const text = buildShare("GLYPH", num, [...rows, headline], won ? challengeUrl(dailyGuesses) : undefined);
    const outcome = await shareResult(text, {
      game: "GLYPH",
      num,
      emoji: "🧿",
      accent: "#e06fae",
      headline,
      lines: rows,
      streak,
    });
    setCopied(outcome !== "failed");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const backToDaily = () => loadDaily();

  return (
    <div className="relative w-full h-full flex flex-col">
      <ModeSwitch
        endless={mode === "endless"}
        onDaily={backToDaily}
        onEndless={startEndless}
      />
      <div className="stat-bar shrink-0">
        <div className="stat">
          <span className="lab">Guess</span>
          <span className="val">
            {Math.min(guessCount + (phase === "play" ? 1 : 0), MAX_GUESSES)}/{MAX_GUESSES}
          </span>
        </div>
        {mode === "endless" ? (
          <>
            <div className="stat">
              <span className="lab">Cracked</span>
              <span className="val">{cracked}</span>
            </div>
            <div className="stat">
              <span className="lab">Best</span>
              <span className="val">{endlessBest}</span>
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

      <p className="hint shrink-0">
        tap symbols, then GO · <span className="tx-ink">🟢 right slot</span> ·{" "}
        <span className="tx-ink">🟡 in the code, wrong slot</span> ·{" "}
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
                  window.localStorage.setItem("gd:glyph:help", "1");
                } catch {}
              }}
            >
              <FontAwesomeIcon icon={faXmark} width={12} height={12} />
            </button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li>
                <span className="tx-ink font-semibold">1. A secret code of {DAILY_LEN} symbols</span>{" "}
                is hiding. No symbol repeats. Everyone gets the same code today.
              </li>
              <li>
                <span className="tx-ink font-semibold">2. Build a guess and hit GO.</span> The pegs
                answer: <span className="tx-ink">green</span> = right symbol in the right slot,{" "}
                <span className="tx-ink">amber ring</span> = in the code but the wrong slot.
              </li>
              <li>
                <span className="tx-ink font-semibold">3. The pegs never say WHICH slot.</span>{" "}
                That is the puzzle - deduce it.
              </li>
              <li>
                <span className="tx-ink font-semibold">4. Crack it in {MAX_GUESSES} guesses.</span>{" "}
                Fewer guesses, more stars. Then go endless - the codes grow.
              </li>
            </ol>
            <button
              onClick={() => {
                setShowHelp(false);
                try {
                  window.localStorage.setItem("gd:glyph:help", "1");
                } catch {}
              }}
              className="btn-ink mt-5 w-full px-5 py-2.5"
            >
              Got it - crack the code
            </button>
            <GuideLink game="glyph" />
          </div>
        </div>
      )}

      {phase === "dayDone" && (
        <Celebration
          title={`GLYPH #${num} cracked!`}
          stars={starsFor(dailyGuesses)}
          score={{ label: "guesses used", value: dailyGuesses }}
          badges={[
            dailyGuesses <= 3 ? "Mind reader 🧠" : `${MAX_GUESSES - dailyGuesses} to spare`,
          ]}
          primary={{ label: copied ? "Shared ✓" : "Share result", onClick: share }}
          secondary={{ label: "Keep going ∞", onClick: startEndless }}
          pill={{ label: "Keep going ∞", onClick: startEndless }}
          footnote={
            endlessBest > 0
              ? `Your endless best: ${endlessBest} codes - beat it?`
              : "Endless codes get longer - how many can you crack?"
          }
          countdown
          feedback="glyph"
        />
      )}

      {phase === "dayFail" && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel text-center max-sm max-w-sm">
            <div className="text-4xl mb-2">🔒</div>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-1">The code held.</h2>
            <p className="tx-muted mb-1">GLYPH #{num}: out of guesses. It was:</p>
            <p className="text-2xl mb-3" aria-label="today's code">
              {codeRef.current.map((s) => ["🔴", "🟡", "🟦", "🟪", "⭐", "🌸", "🌙", "🟠"][s]).join(" ")}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={share} className="btn-ink px-5 py-2.5">
                {copied ? "Shared ✓" : "Share the attempt"}
              </button>
              <button onClick={startEndless} className="btn-line px-5 py-2.5">
                Endless ∞
              </button>
            </div>
            <PuzzleRating game="glyph" />
            <p className="text-xs tx-soft mt-3">
              <Countdown prefix="A fresh code at midnight -" />
            </p>
          </div>
        </div>
      )}

      {phase === "roundClear" && (
        <Celebration
          title={`Code ${cracked} cracked!`}
          stars={starsFor(rowsRef.current.length)}
          score={{ label: "codes this run", value: cracked }}
          badges={[`in ${rowsRef.current.length} guesses`, `next: ${roundCfg(roundRef.current + 1).len} symbols`]}
          primary={{
            label: "Next code →",
            onClick: () => {
              roundRef.current += 1;
              nextEndlessRound();
            },
          }}
          footnote="Longer codes, bigger palette - same six guesses."
        />
      )}

      {phase === "runOver" && (
        <Celebration
          title="The code held."
          stars={cracked >= 6 ? 3 : cracked >= 3 ? 2 : cracked >= 1 ? 1 : 0}
          score={{ label: "codes cracked", value: cracked }}
          badges={[cracked >= endlessBest && cracked > 0 ? "New best! 🏆" : `Best run: ${endlessBest}`]}
          primary={{ label: "Run it back →", onClick: startEndless }}
          secondary={{ label: "← Daily", onClick: backToDaily }}
          footnote="Six guesses is all you ever get."
        />
      )}
    </div>
  );
}
