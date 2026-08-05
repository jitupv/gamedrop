"use client";

import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faXmark } from "@fortawesome/free-solid-svg-icons";
import { isMuted } from "@/lib/sdk/sound";
import { shareLevel } from "@/lib/sdk/levelShare";
import Countdown from "./Countdown";
import PuzzleRating from "./PuzzleRating";
import { SITE_EMAIL } from "@/lib/site";

const CONFETTI_COLORS = ["#c96f4a", "#d9a441", "#8a9a5b", "#6f8fa8", "#9d7a94", "#b25d6d", "#d97706"];

interface Action {
  label: string;
  onClick: () => void;
}

export default function Celebration({
  title,
  subtitle,
  stars,
  score,
  badges,
  primary,
  secondary,
  pill,
  share,
  footnote,
  countdown,
  feedback,
  finalWeek,
  delayMs = 900,
}: {
  title: string;
  subtitle?: string;
  stars: number; // 0-3 earned
  score?: { label: string; value: number; decimals?: number; suffix?: string };
  badges?: string[];
  primary: Action;
  secondary?: Action;
  pill?: Action; // what the floating continue-pill does after ✕ (defaults to primary)
  // present on level clears - the panel owns the share button and its own
  // "Shared ✓" state, so no game has to carry share wiring of its own
  share?: { game: string; level: number };
  footnote?: string;
  countdown?: boolean; // show the live "next challenge at midnight" ticker
  feedback?: string; // game id - shows a one-tap "how was today's puzzle?" emoji row
  finalWeek?: boolean;
  delayMs?: number; // leave the final board state visible before showing results
}) {
  const [display, setDisplay] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreValue = score?.value ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), Math.max(0, delayMs));
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  // score counts up from zero
  useEffect(() => {
    if (!revealed) return;
    const t0 = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setDisplay(scoreValue * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scoreValue, revealed]);

  // one-shot jingle + confetti on mount
  useEffect(() => {
    if (!revealed) return;
    if (stars > 0 && !isMuted()) {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          const actx = new AC();
          const notes = stars >= 3 ? [523, 659, 784, 1047, 1319] : stars === 2 ? [523, 659, 784] : [523, 659];
          notes.forEach((f, i) => {
            const o = actx.createOscillator();
            const g = actx.createGain();
            o.type = "triangle";
            o.frequency.value = f;
            g.gain.setValueAtTime(0.07, actx.currentTime + i * 0.09);
            g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.09 + 0.28);
            o.connect(g).connect(actx.destination);
            o.start(actx.currentTime + i * 0.09);
            o.stop(actx.currentTime + i * 0.09 + 0.32);
          });
        }
      } catch {}
    }

    const canvas = canvasRef.current;
    if (!canvas || stars <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = canvas.offsetWidth);
    const H = (canvas.height = canvas.offsetHeight);
    const parts = Array.from({ length: 34 * stars }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.45,
      y: H * 0.32,
      vx: (Math.random() - 0.5) * 9,
      vy: -4 - Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 1,
    }));
    let raf = 0;
    const step = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24;
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 0.008;
        if (p.life <= 0 || p.y > H + 20) continue;
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(step);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, stars]);

  const fmt = (v: number) =>
    score?.decimals ? v.toFixed(score.decimals) : Math.round(v).toLocaleString();

  const doShare = async () => {
    if (!share || sharing) return;
    setSharing(true);
    const outcome = await shareLevel(share.game, share.level);
    setSharing(false);
    if (outcome === "failed") return;
    setShared(true);
    window.setTimeout(() => setShared(false), 2000);
  };

  if (!revealed) return null;

  // dismissed: reveal the board, keep a floating continue pill so nobody gets stuck
  if (hidden) {
    const pillAction = pill ?? primary;
    return (
      <button
        onClick={pillAction.onClick}
        className="btn-ink fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 shadow-xl"
      >
        {pillAction.label}
      </button>
    );
  }

  return (
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4 pt-12">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />
      <div className="panel celebrate-panel text-center max-w-sm relative">
        <button className="panel-x" aria-label="Close" onClick={() => setHidden(true)}>
          <FontAwesomeIcon icon={faXmark} width={12} height={12} />
        </button>
        <div className="ribbon">{title}</div>
        {subtitle && <p className="tx-muted text-sm mt-3">{subtitle}</p>}
        <div
          className="mt-4 flex justify-center gap-2"
          role="img"
          aria-label={`${stars} out of 3 stars earned`}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`star-slot ${i < stars ? "star-earned" : ""}`}
              style={i < stars ? { animationDelay: `${0.15 + i * 0.22}s` } : undefined}
              aria-hidden="true"
            >
              {i < stars ? (
                <FontAwesomeIcon icon={faStar} width={40} height={40} />
              ) : (
                <span className="star-empty">☆</span>
              )}
            </span>
          ))}
        </div>
        {score && (
          <p className="mt-2">
            <span className="text-4xl font-extrabold tracking-tight tx-ink tabular-nums">
              {fmt(display)}
              {score.suffix || ""}
            </span>
            <span className="overline block mt-1">{score.label}</span>
          </p>
        )}
        {badges && badges.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {badges.map((b) => (
              <span key={b} className="badge">
                {b}
              </span>
            ))}
          </div>
        )}
        {share ? (
          // On a level clear the share is the point, so it takes the solid
          // button and "Level N →" steps down to an outline beside it. Replay
          // is the rarest of the three, so it drops to a text link underneath
          // instead of competing as a third button.
          <>
            <div className="mt-5 flex gap-2.5 justify-center items-center flex-wrap">
              <button
                onClick={doShare}
                disabled={sharing}
                className="btn-ink px-6 py-2.5 disabled:opacity-60"
              >
                {shared ? "Shared ✓" : "Challenge a friend"}
              </button>
              <button onClick={primary.onClick} className="btn-line px-5 py-2.5">
                {primary.label}
              </button>
            </div>
            {secondary && (
              <button
                onClick={secondary.onClick}
                className="mt-3 text-xs tx-muted underline underline-offset-4 hover:tx-ink"
              >
                {secondary.label}
              </button>
            )}
          </>
        ) : (
          <div className="mt-5 flex gap-3 justify-center flex-wrap">
            <button onClick={primary.onClick} className="btn-ink px-6 py-2.5">
              {primary.label}
            </button>
            {secondary && (
              <button onClick={secondary.onClick} className="btn-line px-5 py-2.5">
                {secondary.label}
              </button>
            )}
          </div>
        )}
        {feedback && <PuzzleRating game={feedback} />}
        {footnote && <p className="text-xs tx-soft mt-4">{footnote}</p>}
        {finalWeek && (
          <p className="text-xs tx-soft mt-4">
            You finished this week&apos;s run. Come back next Monday for a fresh challenge.{" "}
            <a
              className="underline tx-ink font-semibold"
              href={`mailto:${SITE_EMAIL}?subject=${encodeURIComponent("My JEETLE game idea")}`}
            >
              Tell us the game in your mind
            </a>{" "}
            and it could become a game everyone can try.
          </p>
        )}
        {countdown && (
          <p className="text-xs tx-soft mt-1">
            <Countdown />
          </p>
        )}
      </div>
    </div>
  );
}
