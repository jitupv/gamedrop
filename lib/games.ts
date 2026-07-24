export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  status: "live" | "soon";
  emoji: string;
  path: string;
  unit: string; // what the daily score measures
  higherIsBetter: boolean;
  drop: number; // release order in the catalog — highest = this week's drop
}

// Friday drop rotation — the featured game advances automatically each week.
// When a NEW game ships, put its id first in line for the upcoming Friday.
const FIRST_DROP_UTC = Date.UTC(2026, 6, 24); // Fri Jul 24 2026 — TILT's week; flips every Friday
const ROTATION = ["tilt", "orbit", "sonar", "heist", "rush", "trace"];

export function featuredGameId(now = new Date()): string {
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const week = Math.max(0, Math.floor((todayUTC - FIRST_DROP_UTC) / (7 * 86400000)));
  return ROTATION[week % ROTATION.length];
}

export const GAMES: GameMeta[] = [
  {
    id: "tilt",
    drop: 6,
    name: "TILT",
    tagline: "Swipe the whole board. Match. Chain. Repeat.",
    status: "live",
    emoji: "🍬",
    path: "/tilt",
    unit: "pts",
    higherIsBetter: true,
  },
  {
    id: "orbit",
    drop: 1,
    name: "ORBIT",
    tagline: "Golf, but the course is a solar system.",
    status: "live",
    emoji: "🪐",
    path: "/orbit",
    unit: "launches",
    higherIsBetter: false,
  },
  {
    id: "sonar",
    drop: 2,
    name: "SONAR",
    tagline: "You're blind. Sound is your eyes.",
    status: "live",
    emoji: "🔦",
    path: "/sonar",
    unit: "pings",
    higherIsBetter: false,
  },
  {
    id: "heist",
    drop: 3,
    name: "HEIST",
    tagline: "Plan the perfect robbery. Then watch it go wrong.",
    status: "live",
    emoji: "💎",
    path: "/heist",
    unit: "plans",
    higherIsBetter: false,
  },
  {
    id: "rush",
    drop: 4,
    name: "RUSH",
    tagline: "You are the traffic light. Don't let them touch.",
    status: "live",
    emoji: "🚦",
    path: "/rush",
    unit: "cars",
    higherIsBetter: true,
  },
  {
    id: "trace",
    drop: 5,
    name: "TRACE",
    tagline: "See it. Lose it. Draw it from memory.",
    status: "live",
    emoji: "✏️",
    path: "/trace",
    unit: "%",
    higherIsBetter: true,
  },
];
