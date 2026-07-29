"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBars,
  faCheck,
  faCircleUser,
  faFire,
  faRankingStar,
  faStar,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import AccountModal from "@/components/AccountModal";
import NotifyMe from "@/components/NotifyMe";
import VoteCard from "@/components/VoteCard";
import GameArt from "@/components/GameArt";
import HomeBoard from "@/components/HomeBoard";
import ThemeToggle from "@/components/ThemeToggle";
import { GAMES, featuredGameId } from "@/lib/games";
import { dayNumber, todayKey } from "@/lib/sdk/daily";
import { getStreak, loadResult } from "@/lib/sdk/storage";

// homepage-only copy & styling per game - gameplay meta lives in lib/games.ts
// `drop` = release order in the catalog story; the featured game is the newest drop
const HOME: Record<
  string,
  { accent: string; genre: string; desc: string; lede: [string, string, string]; diff: 1 | 2 | 3; time: string }
> = {
  prism: {
    accent: "#ff2d6f",
    genre: "Laser logic",
    desc: "A laser fires from a fixed point. Bend it with mirrors through every target - on a strict budget.",
    lede: ["A laser fires.", "Bend it with mirrors.", "Every target, on a strict mirror budget."],
    diff: 2,
    time: "2-4 min",
  },
  tilt: {
    accent: "#ff6f61",
    genre: "Match puzzle",
    desc: "Slide entire rows and columns. Line up three. Chain combos before the moves run out.",
    lede: ["Swipe whole rows.", "Match the candy.", "Chain combos before the moves run out."],
    diff: 2,
    time: "3-5 min",
  },
  orbit: {
    accent: "#9d8cff",
    genre: "Physics",
    desc: "One probe, real gravity. Sling around planets and thread the needle - no direct shots.",
    lede: ["One probe, real gravity.", "Sling around planets.", "Direct shots don't count here."],
    diff: 3,
    time: "2-4 min",
  },
  sonar: {
    accent: "#3fd6c0",
    genre: "Memory maze",
    desc: "You're blind in a maze. Each ping lights it up for a heartbeat - remember the walls.",
    lede: ["Ping the dark.", "Memorize the maze.", "Escape in as few pings as your nerves allow."],
    diff: 2,
    time: "2-4 min",
  },
  heist: {
    accent: "#3fbf7f",
    genre: "Stealth logic",
    desc: "Plan the perfect route past patrolling guards - they move when you move.",
    lede: ["Case the museum.", "Plan every step.", "The guards move when you move."],
    diff: 3,
    time: "3-6 min",
  },
  rush: {
    accent: "#ffa23e",
    genre: "Reflex",
    desc: "You control the traffic lights, not the cars. Keep the intersection flowing - no crashes.",
    lede: ["You are the traffic light.", "Time every green.", "Don't let them touch."],
    diff: 2,
    time: "2-3 min",
  },
  trace: {
    accent: "#6fa8ff",
    genre: "Drawing",
    desc: "One stroke, no undo. Trace the target shape as precisely as your hand allows.",
    lede: ["See it once.", "Draw it blind.", "One stroke, no undo."],
    diff: 1,
    time: "1-3 min",
  },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Home() {
  const [num, setNum] = useState<number | null>(null);
  const [todayId, setTodayId] = useState(GAMES[0].id);
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState<Record<string, boolean>>({});
  const [midnight, setMidnight] = useState("-:-:-");
  const [stickyHidden, setStickyHidden] = useState(true);
  const [showAccount, setShowAccount] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setNum(dayNumber());
    setTodayId(featuredGameId()); // always the newest drop

    const key = todayKey();
    const done: Record<string, boolean> = {};
    let best = 0;
    for (const g of GAMES) {
      done[g.id] = !!loadResult(g.id, key)?.won;
      best = Math.max(best, getStreak(g.id, key));
    }
    setDoneToday(done);
    setStreak(best);

    const tick = () => {
      const now = new Date();
      const mid = new Date(now);
      mid.setHours(24, 0, 0, 0);
      const s = Math.floor((mid.getTime() - now.getTime()) / 1000);
      setMidnight(`${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // the mobile sticky bar hides while the hero CTA is on screen
  useEffect(() => {
    const cta = ctaRef.current;
    if (!cta || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => setStickyHidden(entries[0].isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(cta);
    return () => obs.disconnect();
  }, [todayId]);

  const today = GAMES.find((g) => g.id === todayId)!;
  const meta = HOME[today.id];
  // past drops, newest first - the featured game is always the latest drop
  const vault = GAMES.filter((g) => g.id !== todayId).sort((a, b) => b.drop - a.drop);
  const chNum = num !== null ? `#${pad(num)}` : "#-";

  return (
    <div className="hm" style={{ "--g": meta.accent } as React.CSSProperties}>
      <header className="hm-header">
        <div className="hm-wrap hm-header-inner">
          <Link href="/" className="hm-brand">
            JEETLE<span>.</span>
          </Link>
          <nav className="hm-nav">
            <button type="button" className="hm-navbtn" onClick={() => setShowBoard(true)}>
              Leaderboard
            </button>
            <a href="#vault">The Vault</a>
            <button
              type="button"
              className="theme-toggle"
              aria-label="Your player card"
              onClick={() => setShowAccount(true)}
            >
              <FontAwesomeIcon icon={faCircleUser} width={15} height={15} />
            </button>
            <ThemeToggle />
            {streak > 0 && (
              <span className="hm-streak" title="Your daily streak">
                <FontAwesomeIcon icon={faFire} width={12} height={12} /> {streak}
              </span>
            )}
          </nav>
          <button
            type="button"
            className="hm-burger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <FontAwesomeIcon icon={menuOpen ? faXmark : faBars} width={15} height={15} />
          </button>
        </div>
        {menuOpen && (
          <div className="hm-menu hm-wrap">
            <button
              type="button"
              onClick={() => {
                setShowBoard(true);
                setMenuOpen(false);
              }}
            >
              Leaderboard
            </button>
            <a href="#vault" onClick={() => setMenuOpen(false)}>
              The Vault
            </a>
            <button
              type="button"
              onClick={() => {
                setShowAccount(true);
                setMenuOpen(false);
              }}
            >
              Your player card{" "}
              <FontAwesomeIcon icon={faCircleUser} width={15} height={15} />
            </button>
            <div className="hm-menu-row">
              <span>Theme</span>
              <ThemeToggle />
            </div>
            {streak > 0 && (
              <div className="hm-menu-row">
                <span>Daily streak</span>
                <span className="hm-streak">
                  <FontAwesomeIcon icon={faFire} width={12} height={12} /> {streak}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      <section className="hm-hero">
        <div className="hm-wrap hm-hero-grid">
          <div>
            <p className="hm-eyebrow">
              Drop {pad(today.drop)} <span>·</span> our newest game
            </p>
            <h1 className="hm-title">
              {today.name}
              <span>.</span>
            </h1>
            <p className="hm-lede">
              {meta.lede[0]} <strong>{meta.lede[1]}</strong> {meta.lede[2]}
            </p>

            <div className="hm-chips">
              <span className="hm-chip">{meta.time}</span>
              <span className="hm-chip">Free</span>
              <span className="hm-chip">Nothing to install</span>
            </div>

            <div className="hm-cta">
              <div className="hm-cta-row">
                <Link ref={ctaRef} href={today.path} className="hm-play">
                  Play now{" "}
                  <span className="arr">
                    <FontAwesomeIcon icon={faArrowRight} width={15} height={15} />
                  </span>
                </Link>
                <button type="button" className="hm-boardbtn" onClick={() => setShowBoard(true)}>
                  <FontAwesomeIcon icon={faRankingStar} width={15} height={15} /> Leaderboard
                </button>
              </div>
              <p className="hm-meta">
                Challenge <b>{chNum}</b> - same puzzle for everyone · fresh puzzle at midnight{" "}
                <b className="hm-count">{midnight}</b>
              </p>
              {streak > 0 && (
                <p className="hm-streaknote">
                  <b>
                    <FontAwesomeIcon icon={faFire} width={12} height={12} /> {streak}-day streak
                  </b>{" "}
                  - today&apos;s challenge keeps it alive.
                </p>
              )}
              <Link href={`${today.path}/how-to-play`} className="hm-guidelink">
                New here? How to play {today.name}
              </Link>
            </div>
          </div>

          <div className="hm-scene">
            <GameArt id={today.id} />
          </div>
        </div>
      </section>

      <section className="hm-vault hm-wrap" id="vault">
        <div className="hm-vhead">
          <h2>The Vault</h2>
          <p>Every game we&apos;ve ever dropped - each with its own daily challenge and endless mode.</p>
        </div>

        <div className="hm-grid">
          {/* each vault card links straight to its game */}
          {[today, ...vault].map((g) => {
            const m = HOME[g.id];
            const isFeatured = g.id === todayId;
            const isDone = doneToday[g.id];
            return (
              <Link
                key={g.id}
                href={g.path}
                className="hm-card"
                style={{ "--g": m.accent } as React.CSSProperties}
              >
                <div className="hm-thumb">
                  {isFeatured && (
                    <span className="hm-flag">
                      <FontAwesomeIcon icon={faStar} width={10} height={10} /> Newest
                    </span>
                  )}
                  {!isFeatured && isDone && (
                    <span className="hm-flag done">
                      <FontAwesomeIcon icon={faCheck} width={10} height={10} /> Done today
                    </span>
                  )}
                  <GameArt id={g.id} />
                </div>
                <div className="hm-gbody">
                  <span className="hm-dropnum">Drop {pad(g.drop)}</span>
                  <div className="hm-grow">
                    <span className="hm-gname">{g.name}</span>
                    <span className="hm-genre">{m.genre}</span>
                  </div>
                  <p className="hm-desc">{m.desc}</p>
                  <div className="hm-gmeta">
                    <span className="hm-gstat">
                      <span className="hm-dots">
                        {[1, 2, 3].map((d) => (
                          <i key={d} className={d <= m.diff ? "on" : ""} />
                        ))}
                      </span>
                      {m.time}
                    </span>
                    <span className="hm-playlink">
                      {isDone ? "Endless mode" : "Play daily"}{" "}
                      <FontAwesomeIcon icon={faArrowRight} width={11} height={11} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="hm-strip">
        <div className="hm-wrap hm-strip-inner">
          <div className="hm-fact">
            <span className="k">New games</span>
            <span className="v">Fresh drops keep coming</span>
            <span className="d">Original games built from scratch - never reruns, never clones.</span>
          </div>
          <div className="hm-fact">
            <span className="k">Midnight</span>
            <span className="v">Every game gets a fresh challenge</span>
            <span className="d">Same puzzle for the whole world. One shot at the daily.</span>
          </div>
          <div className="hm-fact">
            <span className="k">The Vault</span>
            <span className="v">Old drops stay playable</span>
            <span className="d">Daily + endless mode in every game, forever free.</span>
          </div>
        </div>
      </section>

      <section className="hm-next hm-wrap">
        <div className="hm-next-card">
          <div className="hm-next-body">
            <span className="k">Drop {pad(today.drop + 1)} · in the workshop</span>
            <h3>Something new is being built.</h3>
            <p>
              A brand-new original game joins the Vault when it&apos;s ready. No reruns, no clones -
              we build them from scratch.
            </p>
            <NotifyMe />
          </div>
          <div className="hm-next-art" aria-hidden="true">
            <span className="scan" />
            <span className="q">?</span>
          </div>
        </div>
      </section>

      <VoteCard />

      <footer className="hm-foot">
        <div className="hm-wrap hm-foot-inner">
          <span className="hm-fbrand">
            JEETLE<span>.</span>
          </span>
          <nav>
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      {showBoard && (
        <HomeBoard game={today} accent={meta.accent} onClose={() => setShowBoard(false)} />
      )}

      <div className={`hm-sticky ${stickyHidden ? "is-off" : ""}`}>
        <div className="hm-sticky-inner">
          <div className="s-info">
            <span className="s-name">
              {today.name} - Challenge {chNum}
            </span>
            <span className="s-sub">Fresh puzzle in {midnight}</span>
          </div>
          <Link href={today.path} className="s-btn">
            Play now
          </Link>
        </div>
      </div>
    </div>
  );
}
