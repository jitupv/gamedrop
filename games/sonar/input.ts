export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

export interface Direction {
  x: number;
  y: number;
}

const FLICK_WINDOW_MS = 110;
const MIN_FLICK_DURATION_MS = 18;
const MIN_FLICK_DISTANCE_CELLS = 0.45;
const MIN_FLICK_SPEED_CELLS = 7;

// Only recent movement counts. A quick swipe followed by a short hold is
// treated as deliberate navigation and stops where the player released.
export function flickDirection(
  samples: PointerSample[],
  releasedAt: number,
  cellSize: number
): Direction | null {
  if (cellSize <= 0 || samples.length < 2) return null;
  const recent = samples.filter((sample) => sample.t >= releasedAt - FLICK_WINDOW_MS);
  if (recent.length < 2) return null;

  const start = recent[0];
  const end = recent[recent.length - 1];
  const durationMs = end.t - start.t;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (durationMs < MIN_FLICK_DURATION_MS || distance < cellSize * MIN_FLICK_DISTANCE_CELLS) {
    return null;
  }

  const speedCells = distance / cellSize / (durationMs / 1000);
  if (speedCells < MIN_FLICK_SPEED_CELLS) return null;
  return { x: dx / distance, y: dy / distance };
}
