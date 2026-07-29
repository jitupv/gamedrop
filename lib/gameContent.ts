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
  prism: {
    id: "prism",
    name: "PRISM",
    genre: "Laser and mirror logic puzzle",
    playTitle: "PRISM - free daily laser and mirror puzzle | JEETLE",
    playDescription:
      "Bend a laser through every target using a limited budget of mirrors. A free daily logic puzzle in your browser, no download.",
    guideTitle: "How to play PRISM - laser and mirror puzzle tips and guide | JEETLE",
    guideDescription:
      "Learn how to play PRISM, the free daily laser and mirror puzzle. Rules, mirror budgeting, and strategy to route the beam in fewer mirrors.",
    what: "PRISM is a free daily logic puzzle you play in your browser. A laser fires from a fixed emitter and travels in a straight line until it hits a wall, leaves the grid, or is bent by a mirror you place. Tap cells to lay down angled mirrors and route the beam through every target ring on its way to the receiver - using as few mirrors as you can from a strictly limited budget.",
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
      { q: "What is the daily challenge?", a: "Every day at midnight PRISM generates three new boards that are identical for every player in the world. Clear them and share your mirror count with friends." },
      { q: "Is there an endless mode?", a: "Yes. In endless mode the boards keep growing and a shared mirror bank only partially refills after each one - spend mirrors wisely, because the bank eventually runs out." },
      { q: "Why can't I place a mirror on some cells?", a: "Mirrors can't sit on walls, the emitter, the receiver, or a target ring - only on plain empty cells the beam can freely pass through." },
    ],
  },

  tilt: {
    id: "tilt",
    name: "TILT",
    genre: "Match and slide puzzle",
    playTitle: "TILT - free daily match puzzle | JEETLE",
    playDescription:
      "Swipe the whole board, slide every tile, and pop lines of three. A free daily match puzzle in your browser, no download.",
    guideTitle: "How to play TILT - tips and daily challenge guide | JEETLE",
    guideDescription:
      "Learn how to play TILT, the free daily match-and-slide puzzle. Rules, scoring, and strategy tips to beat today's challenge.",
    what: "TILT is a free daily match puzzle you play in your browser. Instead of swapping two tiles like most match games, you swipe the entire board at once - every tile slides in that direction, and any line of three or more matching colors pops for points. Simple to start, tricky to master, and a fresh board every day.",
    how: [
      "Swipe any direction (or use the arrow keys) to slide the whole board.",
      "Hold before releasing to preview where every tile will land - glowing tiles are about to pop.",
      "Line up three or more of the same color in a row or column to clear them and score.",
      "Cleared tiles make the ones above fall, which can chain into cascade combos for bonus points.",
      "Reach the target score before you run out of moves to clear the level.",
    ],
    tips: [
      "Always hold to preview first. You can audition all four directions before committing to the best one.",
      "Set up cascades on purpose: clearing tiles low on the board lets the tiles above fall into fresh matches.",
      "Save your biggest combos for when you are low on moves and need a lot of points fast.",
      "Watch the edges. Tiles pile against walls, so plan how a slide stacks them.",
    ],
    faq: [
      { q: "Is TILT free to play?", a: "Yes. TILT is completely free to play in any web browser, with no download and no sign-up required." },
      { q: "What is the daily challenge?", a: "Every day at midnight TILT generates one new set of boards that is identical for every player in the world. Beat it and share your score with friends." },
      { q: "Is there an endless mode?", a: "Yes. Endless mode removes the move limit - survive as long as you can as the number of colors increases, and chase your personal best score." },
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
    playTitle: "SONAR - free daily maze memory game | JEETLE",
    playDescription:
      "You are blind in a dark maze. Ping to reveal the walls, memorize them, and escape. A free daily memory game, no download.",
    guideTitle: "How to play SONAR - maze memory tips and guide | JEETLE",
    guideDescription:
      "Learn how to play SONAR, the free daily maze memory game. How pinging works, plus strategy to escape in as few pings as possible.",
    what: "SONAR is a free daily maze memory game. You are a dot in a pitch-black maze. Tap to send out a ping that lights up the nearby walls for a heartbeat, then you memorize the layout and feel your way to the exit in the dark. It rewards memory and nerve, not fast reflexes.",
    how: [
      "Hold and drag to move your dot through the darkness.",
      "Tap the ping button to briefly reveal the walls around you.",
      "Memorize the layout quickly - the light fades fast.",
      "Head toward the glowing gold exit.",
      "Escape every maze using as few pings as you can.",
    ],
    tips: [
      "Ping at junctions and corners, not in long straight corridors where you already know the way.",
      "Keep moving while you still remember the last ping - do not wait for the light to fade.",
      "The exit always glows faintly through the dark, so orient toward it.",
      "Fewer pings score better, so trust your memory instead of pinging on every step.",
    ],
    faq: [
      { q: "Is SONAR free?", a: "Yes, SONAR is free to play in any browser, with no download or sign-up." },
      { q: "How does pinging work?", a: "Each ping lights up the walls near you for about a second, then fades. You memorize what you saw and move through the dark before the next ping." },
      { q: "Is there an endless mode?", a: "Yes. In endless mode the mazes keep growing and a lantern timer tightens each round. See how deep you can go before the dark wins." },
    ],
  },

  heist: {
    id: "heist",
    name: "HEIST",
    genre: "Stealth planning puzzle",
    playTitle: "HEIST - free daily stealth planning puzzle | JEETLE",
    playDescription:
      "Plan the perfect robbery: grab every gem, dodge patrolling guards, reach the exit. A free daily stealth puzzle, no download.",
    guideTitle: "How to play HEIST - stealth puzzle tips and guide | JEETLE",
    guideDescription:
      "Learn how to play HEIST, the free daily stealth planning puzzle. Route rules, guard timing, and strategy to pull the perfect crime.",
    what: "HEIST is a free daily stealth puzzle. You plan a thief's entire route through a museum, past guards walking fixed patrol loops, collecting every gem before reaching the exit. Then you press GO and watch your plan play out. Guards move when you move, so it is a puzzle of routing and timing, not reflexes.",
    how: [
      "Drag a route from the thief, one tile at a time.",
      "Collect every gem - the exit stays locked until your route grabs them all.",
      "Each tile can be used only once, so no doubling back to wait out a guard.",
      "Guards move when you move; the faint marker shows where each guard will be at your plan's last step.",
      "Press GO. If a guard catches you, replan. Pull it off in the fewest plans to win.",
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
      { q: "Is there an endless mode?", a: "Yes. Endless mode gives you ever-larger museums with more guards. See how many perfect heists you can chain." },
    ],
  },

  rush: {
    id: "rush",
    name: "RUSH",
    genre: "Reflex and timing game",
    playTitle: "RUSH - free daily traffic light reflex game | JEETLE",
    playDescription:
      "You are the traffic light. Time your greens, keep cars flowing, never let two touch. A free daily reflex game, no download.",
    guideTitle: "How to play RUSH - traffic light game tips and guide | JEETLE",
    guideDescription:
      "Learn how to play RUSH, the free daily traffic-light reflex game. Timing tips and strategy to pass more cars without a crash.",
    what: "RUSH is a free daily reflex game. You control a single traffic light at a busy four-way intersection. Toggle it to let each direction of cars through, keep the intersection flowing, and never let two cars touch. It starts calm and speeds up until one wrong moment ends the run.",
    how: [
      "Tap to toggle which direction has the green light.",
      "Let cars pass through the intersection without colliding.",
      "The cars keep coming, faster and faster.",
      "A single crash ends the run instantly.",
      "Pass the daily goal of cars to clear today's challenge.",
    ],
    tips: [
      "Watch the fastest-approaching lane, not just the nearest car.",
      "As speed rises, short frequent switches beat holding one direction green.",
      "Anticipate the gap: toggle just before it closes, not after.",
      "Stay calm - panic-tapping is what causes most crashes.",
    ],
    faq: [
      { q: "Is RUSH free?", a: "Yes, RUSH is free to play in any browser with no download or sign-up." },
      { q: "What is the daily challenge?", a: "Each day RUSH gives everyone the same seeded traffic sequence and a target number of cars to pass. Clear it and share your result." },
      { q: "How is RUSH scored?", a: "Your score is the number of cars you get through before a crash. It is inherently endless, so keep pushing for a higher personal best." },
    ],
  },

  trace: {
    id: "trace",
    name: "TRACE",
    genre: "Drawing memory game",
    playTitle: "TRACE - free daily draw-from-memory game | JEETLE",
    playDescription:
      "A shape flashes, then vanishes. Redraw it in one stroke from memory. A free daily drawing memory game, no download.",
    guideTitle: "How to play TRACE - drawing memory tips and guide | JEETLE",
    guideDescription:
      "Learn how to play TRACE, the free daily draw-from-memory game. How scoring works and tips to draw more accurately from memory.",
    what: "TRACE is a free daily drawing-from-memory game. A shape appears on screen for three seconds, then disappears - and you redraw it in one continuous stroke, entirely from memory. Your drawing is scored on how closely it matches the hidden original. No undo, no reference, just your memory and a steady hand.",
    how: [
      "Study the shape for three seconds while it is shown.",
      "When it vanishes, draw it in one continuous stroke.",
      "There is no undo and no reference image - trust your memory.",
      "Press Done to reveal the original over your drawing and see your accuracy.",
      "Score as high as you can across all of the day's sketches.",
    ],
    tips: [
      "Memorize the key turning points, not every tiny wiggle of the line.",
      "Start your stroke where the original shape started for better alignment.",
      "Overall proportions matter more than fine detail, so get the big shape right first.",
      "Draw smoothly - jerky, shaky lines lose accuracy against the clean original.",
    ],
    faq: [
      { q: "Is TRACE free?", a: "Yes, TRACE is free to play in your browser with no download or account." },
      { q: "How is my drawing scored?", a: "TRACE compares your stroke to the hidden original and scores the overlap as a percentage, rewarding both the right shape and the right position." },
      { q: "Is there an endless mode?", a: "Yes. Endless mode gives you three hearts and increasingly tangled shapes - a low-accuracy drawing costs a heart. See how far your memory takes you." },
    ],
  },
};

export const GUIDE_ORDER = ["prism", "tilt", "orbit", "sonar", "heist", "rush", "trace"];
