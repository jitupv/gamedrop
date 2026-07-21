# GAMEDROP

A brand-new original web game every Friday. A fresh daily challenge in every game.
This week's game is always free — the vault is for subscribers.

## Stack

- Next.js 15 + TypeScript + Tailwind 4, deployed on Vercel
- Games: HTML5 Canvas, plain 2D — no game-engine dependency yet
- Shared SDK in `lib/sdk/`: deterministic daily seed (`rng.ts`, `daily.ts`),
  local streaks/results (`storage.ts`), share snippets (`share.ts`)
- Each game lives in `games/<id>/` with a pure-logic `engine.ts` (testable,
  no DOM) and a React canvas component

## Run

```bash
npm install
npm run dev
```

## Games

| Game | Status | Mechanic |
|---|---|---|
| ORBIT 🪐 | live | Gravity golf — slingshot a probe to the beacon in fewest launches |
| SONAR 🔦 | next | Pitch-black maze revealed by sound pings |
| FAIR SHARE 🍰 | planned | Cut a polygon cake into equal pieces |
| HEIST 💎 | planned | Plan a full robbery route, then watch it execute |
