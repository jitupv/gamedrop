// Shared canvas viewport: the canvas element fills ALL space the page gives it;
// the game's fixed logical world (lw×lh) is scaled, centered, and optionally
// rotated 90° (portrait phones) inside it. Slack area is painted with the game's
// own surface color, so the play area always reads as one full-screen surface.
//
// Every game calls applyView() at the top of its render loop and pointToGame()
// in its input handlers. Game logic stays in fixed logical coordinates forever.

export interface View {
  scale: number;
  ox: number;
  oy: number;
  rotate: boolean;
  elW: number;
  elH: number;
}

export function applyView(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  lw: number,
  lh: number,
  rotate: boolean,
  bg: string
): View {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const elW = canvas.clientWidth || 1;
  const elH = canvas.clientHeight || 1;
  const pw = Math.round(elW * dpr);
  const ph = Math.round(elH * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, elW, elH);

  const w = rotate ? lh : lw;
  const h = rotate ? lw : lh;
  const scale = Math.min(elW / w, elH / h);
  const ox = (elW - w * scale) / 2;
  const oy = (elH - h * scale) / 2;
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  if (rotate) {
    ctx.translate(0, lw);
    ctx.rotate(-Math.PI / 2);
  }
  return { scale, ox, oy, rotate, elW, elH };
}

export function pointToGame(
  view: View,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  lw: number
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (view.elW / rect.width) - view.ox;
  const py = (clientY - rect.top) * (view.elH / rect.height) - view.oy;
  const x = px / view.scale;
  const y = py / view.scale;
  return view.rotate ? { x: lw - y, y: x } : { x, y };
}

// draw text pinned to the ELEMENT (screen) space - HUD text stays upright and
// positioned regardless of world rotation. fn receives (elW, elH).
export function inScreenSpace(
  ctx: CanvasRenderingContext2D,
  view: View,
  fn: (elW: number, elH: number) => void
): void {
  ctx.save();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fn(view.elW, view.elH);
  ctx.restore();
}
