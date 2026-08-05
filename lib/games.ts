export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  status: "live" | "soon";
  emoji: string;
  path: string;
  unit: string; // what the leaderboard score measures
  higherIsBetter: boolean;
  drop: number; // release order in the catalog - highest = the newest drop, always featured
  accent: string; // per-game identity color - homepage art, share cards, OG images
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
    id: "pulse",
    drop: 7,
    name: "PULSE",
    tagline: "One tap changes everything. Silence the grid.",
    status: "live",
    emoji: "⚡",
    path: "/pulse",
    unit: "levels",
    higherIsBetter: true,
    accent: "#8b5cf6",
  },
  {
    id: "prism",
    drop: 6,
    name: "PRISM",
    tagline: "Bend a laser through every target. Budget your mirrors.",
    status: "live",
    emoji: "🪞",
    path: "/prism",
    unit: "levels",
    higherIsBetter: true,
    accent: "#ff2d6f",
  },
  {
    id: "tilt",
    drop: 5,
    name: "TILT",
    tagline: "Swipe the whole board. Match. Chain. Repeat.",
    status: "live",
    emoji: "🍬",
    path: "/tilt",
    unit: "levels",
    higherIsBetter: true,
    accent: "#ff6f61",
  },
  // ORBIT is temporarily hidden. Uncomment this entry when the game returns.
  // {
  //   id: "orbit",
  //   drop: 1,
  //   name: "ORBIT",
  //   tagline: "Golf, but the course is a solar system.",
  //   status: "live",
  //   emoji: "🪐",
  //   path: "/orbit",
  //   unit: "launches",
  //   higherIsBetter: false,
  //   accent: "#9d8cff",
  // },
  {
    id: "sonar",
    drop: 1,
    name: "SONAR",
    tagline: "You're blind. Sound is your eyes.",
    status: "live",
    emoji: "🔦",
    path: "/sonar",
    unit: "levels",
    higherIsBetter: true,
    accent: "#3fd6c0",
  },
  {
    id: "heist",
    drop: 2,
    name: "HEIST",
    tagline: "Plan the perfect robbery. Then watch it go wrong.",
    status: "live",
    emoji: "💎",
    path: "/heist",
    unit: "levels",
    higherIsBetter: true,
    accent: "#3fbf7f",
  },
  {
    id: "rush",
    drop: 3,
    name: "RUSH",
    tagline: "You are the traffic light. Don't let them touch.",
    status: "live",
    emoji: "🚦",
    path: "/rush",
    unit: "levels",
    higherIsBetter: true,
    accent: "#ffa23e",
  },
  {
    id: "trace",
    drop: 4,
    name: "TRACE",
    tagline: "See it. Lose it. Draw it from memory.",
    status: "live",
    emoji: "✏️",
    path: "/trace",
    unit: "levels",
    higherIsBetter: true,
    accent: "#6fa8ff",
  },
];
