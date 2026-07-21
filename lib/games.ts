export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  status: "live" | "soon";
  emoji: string;
  path: string;
}

export const GAMES: GameMeta[] = [
  {
    id: "tilt",
    name: "TILT",
    tagline: "Swipe the whole board. Match. Chain. Repeat.",
    status: "live",
    emoji: "🍬",
    path: "/tilt",
  },
  {
    id: "orbit",
    name: "ORBIT",
    tagline: "Golf, but the course is a solar system.",
    status: "live",
    emoji: "🪐",
    path: "/orbit",
  },
  {
    id: "sonar",
    name: "SONAR",
    tagline: "You're blind. Sound is your eyes.",
    status: "live",
    emoji: "🔦",
    path: "/sonar",
  },
  {
    id: "heist",
    name: "HEIST",
    tagline: "Plan the perfect robbery. Then watch it go wrong.",
    status: "live",
    emoji: "💎",
    path: "/heist",
  },
  {
    id: "rush",
    name: "RUSH",
    tagline: "You are the traffic light. Don't let them touch.",
    status: "live",
    emoji: "🚦",
    path: "/rush",
  },
  {
    id: "trace",
    name: "TRACE",
    tagline: "See it. Lose it. Draw it from memory.",
    status: "live",
    emoji: "✏️",
    path: "/trace",
  },
];
