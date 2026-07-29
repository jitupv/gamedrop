export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  status: "live" | "soon";
  emoji: string;
  path: string;
  unit: string; // what the daily score measures
  higherIsBetter: boolean;
  drop: number; // release order in the catalog - highest = the newest drop, always featured
}

// The featured game is simply the newest drop. When a new game ships, give it
// the next `drop` number and it becomes the featured game automatically. If a
// week passes without a new game, the newest one stays featured - the homepage
// never claims an old game is new.
export function featuredGameId(): string {
  return GAMES.reduce((a, b) => (b.drop > a.drop ? b : a)).id;
}

export const GAMES: GameMeta[] = [
  {
    id: "prism",
    drop: 7,
    name: "PRISM",
    tagline: "Bend a laser through every target. Budget your mirrors.",
    status: "live",
    emoji: "🪞",
    path: "/prism",
    unit: "mirrors",
    higherIsBetter: false,
  },
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
