// Human-first "how to play" content for each game. Written to genuinely help a
// new player; keywords appear naturally, never stuffed. Powers the /<game>/how-to-play
// pages, their metadata, and the VideoGame + FAQ structured data.

export interface GameContent {
  id: string;
  name: string;
  genre: string; // e.g. "Maze memory game"
  // metadata for the PLAYABLE game page (/<id>)
  playTitle: string;
  playDescription: string;
  // metadata for the guide page (/<id>/how-to-play)
  guideTitle: string;
  guideDescription: string;
  // content
  what: string; // one honest paragraph: what the game is
  how: string[]; // step-by-step
  tips: string[]; // real strategy
  faq: { q: string; a: string }[];
}

export const GAME_CONTENT: Record<string, GameContent> = {
  pulse: {
    id: "pulse",
    name: "PULSE",
    genre: "Network logic puzzle",
    playTitle: "PULSE - connected lights logic puzzle | JEETLE",
    playDescription: "Tap connected lights, silence the network, and climb a solver-verified 1,000-level logic campaign. Free in your browser.",
    guideTitle: "How to play PULSE - connected lights puzzle guide | JEETLE",
    guideDescription: "Learn PULSE rules, locked-node strategy, star scoring, and how to solve connected light networks efficiently.",
    what: "PULSE is a connected-lights logic puzzle. Tapping one unlocked node changes that node and every node joined to it by a line. Turn every light off to silence the network. Every deterministic level is proven solvable, and an exact solver sets the three-star minimum.",
    how: [
      "Tap an unlocked node to send a pulse through every line connected to it.",
      "The tapped node and all directly connected nodes switch between lit and unlit.",
      "Turn every node off to complete the level; there is no move limit or timer.",
      "Use Undo or Reset whenever an experiment makes the network worse.",
      "Later locked nodes cannot be tapped directly, but pulses from their neighbours still change them.",
    ],
    tips: [
      "Start with nodes that have only one connection; there are fewer ways to change them later.",
      "A node tapped twice cancels itself, so avoid repeating taps unless you intentionally want to undo one.",
      "Work backward from a stubborn locked light and identify every switch capable of changing it.",
      "After solving, replay and remove pairs of unnecessary taps to chase the exact minimum.",
    ],
    faq: [
      { q: "Is PULSE free?", a: "Yes. PULSE is free to play in any modern browser with no download or account required." },
      { q: "How are stars awarded?", a: "The exact solver minimum earns 3 stars. Finish within two extra taps for 2 stars; every other solution earns 1." },
      { q: "Are all PULSE levels solvable?", a: "Yes. Levels are constructed backward from a solution and checked by a binary solver before play." },
      { q: "What do locked nodes do?", a: "Locked nodes still turn on and off, but you must change them by tapping connected unlocked nodes." },
    ],
  },
  prism: {
    id: "prism",
    name: "PRISM",
    genre: "Laser and mirror logic puzzle",
    playTitle: "PRISM - weekly laser and mirror puzzle | JEETLE",
    playDescription:
      "Bend a laser through every target across increasingly difficult weekly levels. Free to play in your browser, no download.",
    guideTitle: "How to play PRISM - laser and mirror puzzle tips and guide | JEETLE",
    guideDescription:
      "Learn how to play PRISM, a weekly laser and mirror puzzle. Rules, mirror budgeting, and strategy to route the beam in fewer mirrors.",
    what: "PRISM is a free weekly logic puzzle you play in your browser. A laser fires from a fixed emitter and travels in a straight line until it hits a wall, leaves the grid, or is bent by a mirror you place. Tap cells to lay down angled mirrors and route the beam through every target ring on its way to the receiver - using as few mirrors as you can from a strictly limited budget.",
    how: [
      "Watch the beam leave the emitter and travel in a straight line.",
      "Tap an empty cell to place a mirror; tap again to flip its angle, and once more to remove it.",
      "Route the beam so it passes through every glowing ring before reaching the receiver.",
      "You can only have so many mirrors down at once - remove one to free up the budget and try a different route.",
      "The beam can never cross a cell it has already passed through, so plan bends that don't double back on themselves.",
    ],
    tips: [
      "Work backwards from the receiver as often as forwards from the emitter - the last bend is usually the easiest to pin down.",
      "A mirror only ever turns the beam 90 degrees, never straight through or back the way it came - use that to rule out angles fast.",
      "Removing a mirror is free, so experiment. There is no penalty for trying a bend and undoing it.",
      "Fewer mirrors than the budget earns extra stars, so once you find a working route, look for a shorter one.",
    ],
    faq: [
      { q: "Is PRISM free to play?", a: "Yes. PRISM is completely free to play in any web browser, with no download and no sign-up required." },
      { q: "How does the PRISM ladder work?", a: "Every player gets the same weekly ladder. Monday brings new validated placements while the difficulty curve stays consistent." },
      { q: "How does the leaderboard work?", a: "The weekly PRISM board ranks level depth. The homepage adds your weekly depth across every active game, while your career best remains permanent." },
      { q: "Why can't I place a mirror on some cells?", a: "Mirrors can't sit on walls, the emitter, the receiver, or a target ring - only on plain empty cells the beam can freely pass through." },
    ],
  },

  tilt: {
    id: "tilt",
    name: "TILT",
    genre: "Match and slide puzzle",
    playTitle: "TILT - weekly match and slide puzzle | JEETLE",
    playDescription:
      "Swipe the whole board, pop lines of three, and climb increasingly difficult weekly levels. Free in your browser, no download.",
    guideTitle: "How to play TILT - weekly match puzzle guide | JEETLE",
    guideDescription:
      "Learn how to play TILT, earn stars, and climb increasingly difficult match-and-slide levels.",
    what: "TILT is a free weekly match puzzle you play in your browser. Instead of swapping two tiles, you swipe the entire board at once - every tile slides in that direction, and lines of three or more matching colors pop for points. Later levels raise the target, reduce the move allowance, and add more colors.",
    how: [
      "Swipe any direction (or use the arrow keys) to slide the whole board.",
      "Hold before releasing to preview where every tile will land - glowing tiles are about to pop.",
      "Line up three or more of the same color in a row or column to clear them and score.",
      "Cleared tiles make the ones above fall, which can chain into cascade combos for bonus points.",
      "Reach the target score before you run out of moves to clear the level.",
      "Complete levels to unlock the next board. The shared layouts remix every Monday.",
    ],
    tips: [
      "Always hold to preview first. You can audition all four directions before committing to the best one.",
      "Set up cascades on purpose: clearing tiles low on the board lets the tiles above fall into fresh matches.",
      "Save your biggest combos for when you are low on moves and need a lot of points fast.",
      "Watch the edges. Tiles pile against walls, so plan how a slide stacks them.",
    ],
    faq: [
      { q: "Is TILT free to play?", a: "Yes. TILT is completely free to play in any web browser, with no download and no sign-up required." },
      { q: "How are stars awarded?", a: "Reaching the target earns 1 star. Finish with the level's displayed spare-move threshold for 2 or 3 stars." },
      { q: "How does the TILT ladder work?", a: "Boards rotate, reflect, and recolor every Monday without changing their underlying difficulty." },
    ],
  },

  orbit: {
    id: "orbit",
    name: "ORBIT",
    genre: "Gravity golf physics puzzle",
    playTitle: "ORBIT - free daily gravity golf puzzle | JEETLE",
    playDescription:
      "Golf, but the course is a solar system. Sling a probe around planets using real gravity. A free daily physics puzzle, no download.",
    guideTitle: "How to play ORBIT - gravity golf tips and guide | JEETLE",
    guideDescription:
      "Learn how to play ORBIT, the free daily gravity golf puzzle. Aiming, slingshots, and strategy to finish each hole in fewer launches.",
    what: "ORBIT is a free daily physics puzzle: golf, but the course is a solar system. You drag to launch a probe and let the real gravity of the planets curve its path into the beacon. There is never a straight-shot answer, so every hole is a small orbital-mechanics puzzle you solve with one careful launch at a time.",
    how: [
      "Drag anywhere on the screen and release to launch your probe.",
      "Planets pull the probe with real gravity - use them to bend your shot around obstacles.",
      "Release before the aiming ring closes, or the shot is wasted.",
      "Reach the beacon to finish the hole, and grab the bonus star on the way for extra credit.",
      "Complete every hole in as few launches as you can.",
    ],
    tips: [
      "You cannot win with a straight line. Every hole is designed to need a slingshot around a planet.",
      "Watch the dotted preview arc as you aim to see roughly where the probe will travel.",
      "Fuel is limited per hole, so a few smart launches beat spraying shots.",
      "Skim close to a planet for a tight gravity turn, but not so close that you crash into it.",
    ],
    faq: [
      { q: "Is ORBIT free?", a: "Yes, ORBIT is free to play in your browser with no download and no account needed." },
      { q: "Why can't I hit the beacon directly?", a: "Every ORBIT hole is validated so that a straight shot never works - you always have to use a planet's gravity to curve the probe. That is the puzzle." },
      { q: "What is endless mode?", a: "Endless mode is a fuel roguelite: each hole you clear refills some fuel, the systems get denser, and your run ends when you run out. Chase your best streak of holes." },
    ],
  },

  sonar: {
    id: "sonar",
    name: "SONAR",
    genre: "Maze memory game",
    playTitle: "SONAR - weekly dark maze memory game | JEETLE",
    playDescription:
      "Escape increasingly difficult weekly dark mazes. Ping to reveal walls, memorize the route, and reach the glowing exit. Free with no download.",
    guideTitle: "How to play SONAR - maze memory tips and guide | JEETLE",
    guideDescription:
      "Learn how to play SONAR's weekly maze campaign, how ping limits and stars work, and how to escape with fewer pings.",
    what: "SONAR is a weekly maze memory game. You are a dot in a pitch-black maze. Tap to send out a ping that lights up nearby walls for a moment, then memorize the layout and feel your way to the glowing exit. Routes grow longer, while later pings reveal less area for less time and breadcrumbs become fainter.",
    how: [
      "Hold and drag to steer, or flick quickly and release to coast until you hit a wall.",
      "Tap the ping button to briefly reveal the walls around you.",
      "Memorize the layout quickly - the light fades fast.",
      "Head toward the glowing gold exit.",
      "Escape within the ping limit. Meet the level's par for 3 stars, the middle threshold for 2, or use the remaining pings for 1.",
    ],
    tips: [
      "Ping at junctions and corners, not in long straight corridors where you already know the way.",
      "Keep moving while you still remember the last ping - do not wait for the light to fade.",
      "The exit always glows faintly through the dark, so orient toward it.",
      "Fewer pings score better, so trust your memory instead of pinging on every step.",
    ],
    faq: [
      { q: "Is SONAR free?", a: "Yes, SONAR is free to play in any browser, with no download or sign-up." },
      { q: "How does pinging work?", a: "Each ping briefly lights up nearby walls. The reveal radius and duration shrink as levels get harder, so memorize what you see before it fades." },
      { q: "How does the SONAR ladder work?", a: "Every maze is deterministic and solvable. Monday generates a new globally shared maze set and resets the weekly depth board." },
    ],
  },

  heist: {
    id: "heist",
    name: "HEIST",
    genre: "Stealth planning puzzle",
    playTitle: "HEIST - weekly stealth planning puzzle | JEETLE",
    playDescription:
      "Plan increasingly difficult weekly robberies: grab every gem, dodge patrolling guards, and reach the exit. Free to play with no download.",
    guideTitle: "How to play HEIST - stealth puzzle tips and guide | JEETLE",
    guideDescription:
      "Learn how to play HEIST's weekly stealth campaign. Route rules, guard timing, star scoring, and strategy for the perfect crime.",
    what: "HEIST is a weekly stealth puzzle. You plan a thief's entire route through a museum, past guards walking fixed patrol loops, collecting every gem before reaching the exit. Then you press GO and watch your plan play out. Guards move when you move, so it is a puzzle of routing and timing, not reflexes. Later levels add more guards, longer routes, and denser museums.",
    how: [
      "Drag a route from the thief, one tile at a time.",
      "Collect every gem - the exit stays locked until your route grabs them all.",
      "Each tile can be used only once, so no doubling back to wait out a guard.",
      "Guards move when you move; the faint marker shows where each guard will be at your plan's last step.",
      "Press GO. If a guard catches you, replan. One plan earns 3 stars, two earns 2, and three or more earns 1.",
    ],
    tips: [
      "Decide the order to collect the gems first, then connect that path to the exit.",
      "Because you can only pass a spot once, sync your steps so a guard has already moved on.",
      "Avoid dead ends - they waste your single-use tiles and box you in.",
      "The ghost guard shows the danger at the end of your plan, so read it before pressing GO.",
    ],
    faq: [
      { q: "Is HEIST free?", a: "Yes, HEIST is free to play in your browser with no download or account." },
      { q: "Why won't the exit let me through?", a: "The vault is locked until your planned route has collected every gem. Grab them all first, then the exit opens." },
      { q: "How does the HEIST ladder work?", a: "Every level is validated. Guard, gem, wall, and route placements remix globally every Monday." },
    ],
  },

  rush: {
    id: "rush",
    name: "RUSH",
    genre: "Reflex and timing game",
    playTitle: "RUSH - weekly traffic light reflex game | JEETLE",
    playDescription:
      "Climb weekly traffic-control levels by safely passing cars through a busy intersection. Progress survives crashes. Free with no download.",
    guideTitle: "How to play RUSH - traffic light game tips and guide | JEETLE",
    guideDescription:
      "Learn how to play RUSH's weekly traffic campaign, how cumulative car progress works, and how to avoid crashes as traffic tightens.",
    what: "RUSH is a weekly reflex game. You control a single traffic light at a busy four-way intersection. Toggle it to let each direction of cars through, keep the intersection flowing, and never let two cars touch. Every 50 safe cars completes a level, and progress is cumulative across runs so a crash never removes completed cars.",
    how: [
      "Tap to toggle which direction has the green light.",
      "Let cars pass through the intersection without colliding.",
      "The cars keep coming, faster and faster.",
      "A single crash ends the run instantly.",
      "Every 50 safely passed cars completes a level. Higher levels start with slightly tighter traffic and more impatient drivers.",
    ],
    tips: [
      "Watch the fastest-approaching lane, not just the nearest car.",
      "As speed rises, short frequent switches beat holding one direction green.",
      "Anticipate the gap: toggle just before it closes, not after.",
      "Stay calm - panic-tapping is what causes most crashes.",
    ],
    faq: [
      { q: "Is RUSH free?", a: "Yes, RUSH is free to play in any browser with no download or sign-up." },
      { q: "Does a crash reset my level progress?", a: "No. Your current run ends, but every safe car already added during the current week remains saved. Monday begins a new shared traffic season." },
      { q: "How is RUSH scored?", a: "Your run score counts cars passed before a crash. Weekly leaderboard depth increases by one level for every 50 safe cars." },
    ],
  },

  trace: {
    id: "trace",
    name: "TRACE",
    genre: "Drawing memory game",
    playTitle: "TRACE - weekly draw-from-memory game | JEETLE",
    playDescription:
      "Memorize and redraw increasingly complex weekly shapes. A free drawing memory game with saved progress, no download.",
    guideTitle: "How to play TRACE - weekly drawing memory guide | JEETLE",
    guideDescription:
      "Learn how to play TRACE, earn stars from accuracy, and climb increasingly difficult draw-from-memory levels.",
    what: "TRACE is a free drawing-from-memory game with a weekly ladder. A drawing appears briefly, then disappears - redraw it in the same place and at the same size. Your attempt is scored by overlap with the hidden original. Monday changes the globally shared shapes and placements while preserving the difficulty curve.",
    how: [
      "Study the drawing while it is shown. The memorization time decreases in later levels.",
      "When it vanishes, redraw every stroke in the same place and at the same size.",
      "Use one Peek if needed; it briefly reveals the target but deducts 8% from your score.",
      "Press Done to reveal the original over your drawing and see your accuracy.",
      "Reach 35% to pass and unlock the next level. Keep climbing as the drawings become harder.",
    ],
    tips: [
      "Memorize the key turning points, not every tiny wiggle of the line.",
      "Place each shape carefully; position and scale matter as much as its outline.",
      "Overall proportions matter more than fine detail, so get the big shape right first.",
      "On multi-stroke levels, remember the number and order of separate shapes.",
    ],
    faq: [
      { q: "Is TRACE free?", a: "Yes, TRACE is free to play in your browser with no download or account." },
      { q: "How is my drawing scored?", a: "TRACE compares your drawing to the hidden original. Earn 3 stars at 75%, 2 at 55%, or 1 star and pass at 35%. Below 35% must be retried." },
      { q: "How does the TRACE ladder work?", a: "The deterministic weekly levels become harder as you climb. Your current weekly depth is ranked, and your best-ever weekly depth remains in your career stats." },
    ],
  },
};

export const GUIDE_ORDER = [
  "pulse",
  "prism",
  "tilt",
  // "orbit", // Temporarily hidden.
  "sonar",
  "heist",
  "rush",
  "trace",
];
