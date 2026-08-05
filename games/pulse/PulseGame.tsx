"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef, useState } from "react";
import Celebration from "@/components/Celebration";
import GuideLink from "@/components/GuideLink";
import { reportLevelProgress } from "@/lib/sdk/leaderboard";
import { blip, chirp } from "@/lib/sdk/sound";
import { readWeeklyProgress, weekLabel, weeklySeed, writeWeeklyProgress } from "@/lib/sdk/weekly";
import { TOTAL_LEVELS, genLevel, isLit, starsFor } from "./engine";

type Phase = "play" | "clear" | "done";

export default function PulseGame() {
  const season = useRef(weeklySeed("pulse"));
  const [levelIdx, setLevelIdx] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [level, setLevel] = useState(() => genLevel(0, season.current));
  const [state, setState] = useState(level.start);
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("play");
  const [lastStars, setLastStars] = useState(1);
  const [pulseTick, setPulseTick] = useState(0);
  const [affected, setAffected] = useState(0n);
  const [showHelp, setShowHelp] = useState(false);

  const loadLevel = (index: number) => {
    const safe = Math.max(0, Math.min(TOTAL_LEVELS - 1, index));
    const next = genLevel(safe, season.current);
    setLevelIdx(safe);
    setLevel(next);
    setState(next.start);
    setMoves(0);
    setHistory([]);
    setAffected(0n);
    setPhase("play");
  };

  useEffect(() => {
    const progress = readWeeklyProgress("pulse");
    setCompleted(progress);
    if (progress > 0) loadLevel(Math.min(progress, TOTAL_LEVELS - 1));
    try { if (!window.localStorage.getItem("gd:pulse:help:v1")) setShowHelp(true); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (used: number) => {
    chirp(360, 920, 0.34, "triangle", 0.07);
    setLastStars(starsFor(used, level.par));
    const finished = levelIdx + 1;
    const nextCompleted = Math.max(completed, finished);
    if (nextCompleted > completed) {
      setCompleted(nextCompleted);
      writeWeeklyProgress("pulse", nextCompleted);
      reportLevelProgress("pulse", nextCompleted);
    }
    setPhase(finished === TOTAL_LEVELS ? "done" : "clear");
  };

  const tap = (index: number) => {
    if (phase !== "play" || level.nodes[index].locked) return;
    const next = state ^ level.effects[index];
    const used = moves + 1;
    setState(next);
    setMoves(used);
    setHistory((current) => [...current, index]);
    setAffected(level.effects[index]);
    setPulseTick((value) => value + 1);
    blip(isLit(state, index) ? 320 : 560, 0.07, "sine", 0.04);
    if (next === 0n) finish(used);
  };

  const undo = () => {
    if (phase !== "play" || history.length === 0) return;
    const index = history[history.length - 1];
    setState((current) => current ^ level.effects[index]);
    setMoves((current) => Math.max(0, current - 1));
    setHistory((current) => current.slice(0, -1));
    setAffected(level.effects[index]);
    setPulseTick((value) => value + 1);
    blip(260, 0.05, "sine", 0.03);
  };

  const reset = () => {
    if (phase !== "play") return;
    setState(level.start);
    setMoves(0);
    setHistory([]);
    setAffected(0n);
    blip(220, 0.06, "sine", 0.03);
  };

  const lit = level.nodes.reduce((count, _, index) => count + Number(isLit(state, index)), 0);
  const closeHelp = () => {
    setShowHelp(false);
    try { window.localStorage.setItem("gd:pulse:help:v1", "1"); } catch {}
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="stat-bar shrink-0">
        <div className="stat"><span className="lab">Level</span><span className="val">{levelIdx + 1}</span></div>
        <div className="stat"><span className="lab">Completed</span><span className="val">{completed}</span></div>
        <div className="stat"><span className="lab">Moves</span><span className="val">{moves}</span></div>
        <div className="stat"><span className="lab">Lit</span><span className="val">{lit}</span></div>
        <div className="stat"><span className="lab">3 stars</span><span className="val">≤{level.par}</span></div>
      </div>

      <div className="pulse-stage flex-1 min-h-0">
        <svg className="pulse-board" viewBox="0 0 600 600" aria-label={`PULSE level ${levelIdx + 1}`}>
          {level.edges.map(([a, b]) => (
            <line key={`${a}-${b}`} className="pulse-edge" x1={level.nodes[a].x} y1={level.nodes[a].y} x2={level.nodes[b].x} y2={level.nodes[b].y} />
          ))}
          {level.nodes.map((node, index) => {
            const on = isLit(state, index);
            const hit = isLit(affected, index);
            return (
              <g
                key={`${index}-${hit ? pulseTick : 0}`}
                className={`pulse-node ${on ? "on" : ""} ${node.locked ? "locked" : ""} ${hit ? "hit" : ""}`}
                role="button"
                tabIndex={node.locked ? -1 : 0}
                aria-label={`${node.locked ? "Locked " : ""}${on ? "lit" : "unlit"} node ${index + 1}`}
                onClick={() => tap(index)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") tap(index); }}
              >
                <circle className="pulse-hitbox" cx={node.x} cy={node.y} r="41" />
                <circle className="pulse-orb" cx={node.x} cy={node.y} r="29" />
                <circle className="pulse-core" cx={node.x} cy={node.y} r="8" />
                {node.locked && <text x={node.x} y={node.y + 7} textAnchor="middle">×</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 shrink-0 flex items-center justify-center gap-2">
        <button onClick={() => loadLevel(levelIdx - 1)} disabled={levelIdx === 0 || phase !== "play"} className="btn-line px-4 py-2 disabled:opacity-40">Previous</button>
        <button onClick={undo} disabled={!history.length || phase !== "play"} className="btn-line px-4 py-2 disabled:opacity-40">Undo</button>
        <button onClick={reset} disabled={!moves || phase !== "play"} className="btn-line px-4 py-2 disabled:opacity-40">Reset</button>
        <button onClick={() => loadLevel(levelIdx + 1)} disabled={phase !== "play" || levelIdx >= completed || levelIdx >= TOTAL_LEVELS - 1} className="btn-line px-4 py-2 disabled:opacity-40">Next</button>
      </div>

      <p className="hint">tap a node to flip every connected light · <b>no move limit</b> · {weekLabel()} · <button onClick={() => setShowHelp(true)}>how to play?</button></p>

      {showHelp && (
        <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="panel max-w-sm max-h-full overflow-y-auto">
            <button className="panel-x" aria-label="Close" onClick={closeHelp}><FontAwesomeIcon icon={faXmark} width={12} height={12} /></button>
            <h2 className="font-serif text-2xl font-bold tx-ink mb-4 text-center">How to play</h2>
            <ol className="space-y-3 tx-muted text-sm leading-relaxed">
              <li><b className="tx-ink">1. Send a pulse.</b> Tap any unlocked node.</li>
              <li><b className="tx-ink">2. Follow the links.</b> The tapped node and every directly connected node switch on or off.</li>
              <li><b className="tx-ink">3. Silence the grid.</b> Turn every light off to complete the level.</li>
              <li><b className="tx-ink">4. Chase the minimum.</b> The solver&apos;s minimum earns 3 stars; two extra taps still earn 2.</li>
              <li><b className="tx-ink">5. Locked nodes.</b> Later locked lights cannot be tapped, but connected pulses still change them.</li>
            </ol>
            <button onClick={closeHelp} className="btn-ink mt-5 w-full px-5 py-2.5">Start playing</button>
            <GuideLink game="pulse" />
          </div>
        </div>
      )}

      {phase === "clear" && (
        <Celebration
          title={`Level ${levelIdx + 1} complete!`}
          share={{ game: "pulse", level: levelIdx + 1 }}
          stars={lastStars}
          score={{ label: "taps used", value: moves }}
          badges={[`${completed} completed this week`, `3-star minimum: ${level.par}`]}
          primary={{ label: `Level ${levelIdx + 2} →`, onClick: () => loadLevel(levelIdx + 1) }}
          secondary={{ label: "Replay", onClick: () => loadLevel(levelIdx) }}
          footnote="Weekly progress saved. The next network is harder."
        />
      )}

      {phase === "done" && (
        <Celebration
          title="PULSE campaign complete!"
          stars={3}
          score={{ label: "levels completed", value: completed }}
          badges={["1,000 networks silenced ⚡"]}
          primary={{ label: "Replay final level", onClick: () => loadLevel(TOTAL_LEVELS - 1) }}
          secondary={{ label: "Back to level 1", onClick: () => loadLevel(0) }}
          feedback="pulse"
          finalWeek
        />
      )}
    </div>
  );
}
