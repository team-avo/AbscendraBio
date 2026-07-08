// Shared, registry-driven vial-mockup generator.
//
// A portrait vial label is drawn from the live registry values (name, strength,
// FORMULA/CAS/MW, LOT/MFG) in the finished Ascendra layout — left technical panel
// + divider, centered A-mark logo, big name, strength, PURITY box, "For Research
// Use Only", and a navy LOT | MFG footer — then wrapped onto the blank vial base
// image (public/vial-base.png) with a horizontal cylinder projection.
//
// All functions are browser-only (canvas / Image); call them from client
// components inside effects or handlers — never at module load.

export type VialVals = {
  name: string;
  strength: string;
  formula: string;
  cas: string;
  mw: string;
  lot: string;
  mfg: string;
};

export const PURITY_TEXT = "≥99% by HPLC";
export const DEFAULT_NAVY = "#0a2e6e";
const STEEL = "#3e5c8a";
const SLATE = "#5a6b88";
const ACCENT = "#3f7fd0";

// The label face on the 1024x1024 base vial, and the arc it wraps. The generated
// label fills this region (covering any placeholder text on the base).
const VIAL = { region: { x0: 320, y0: 430, x1: 690, y1: 800 }, arc: Math.PI * 1.12 };
const BASE_SRC = "/vial-base-2.png";

// LOT auto-derives from the product name plus a fixed batch suffix, e.g.
// "Thymosin Alpha-1" -> "THYMOSINAL-240501".
export const deriveLot = (name: string) =>
  `${(name || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 10)}-240501`;

function roundRectPath(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}

// Draw a chemical formula with subscript element counts: C129H215... -> C₁₂₉H₂₁₅…
function drawFormula(x: CanvasRenderingContext2D, f: string, X: number, Y: number, size: number, navy: string) {
  x.textAlign = "left";
  let cx = X;
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(f)) !== null) {
    if (!m[1]) continue;
    x.font = `${size}px Arial`; x.fillStyle = navy; x.fillText(m[1], cx, Y);
    cx += x.measureText(m[1]).width;
    if (m[2]) {
      x.font = `${Math.round(size * 0.64)}px Arial`;
      x.fillText(m[2], cx, Y + Math.round(size * 0.18));
      cx += x.measureText(m[2]).width;
    }
  }
}

// Name layout: prefer ONE line (shrink to fit the width down to minOneLine); only
// wrap to two lines if a single line still overflows, then shrink to fit both the
// width and the vertical slot. Break-first / shrink-only-when-needed.
function layoutName(
  x: CanvasRenderingContext2D,
  name: string,
  usableW: number,
  slotTop: number,
  lastBaseline: number,
  maxFont: number,
  minOneLine: number,
) {
  const w1 = (font: number) => { x.font = `800 ${font}px Arial`; return x.measureText(name || "").width; };
  let f1 = maxFont;
  while (f1 > minOneLine && w1(f1) > usableW) f1 -= 2;
  if (w1(f1) <= usableW && lastBaseline - f1 * 0.72 >= slotTop) {
    return { lines: [name], font: f1, lineH: Math.round(f1 * 1.04) };
  }
  const fit = (font: number) => {
    x.font = `800 ${font}px Arial`;
    const toks = (name || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const t of toks) {
      const test = cur ? `${cur} ${t}` : t;
      if (x.measureText(test).width <= usableW) cur = test;
      else { if (cur) lines.push(cur); cur = t; }
    }
    if (cur) lines.push(cur);
    if (!lines.length) lines.push("");
    const maxW = Math.max(...lines.map((l) => x.measureText(l).width), 0);
    const lineH = Math.round(font * 1.04);
    const capTop = lastBaseline - (lines.length - 1) * lineH - font * 0.72;
    return { lines, maxW, lineH, font, ok: maxW <= usableW && capTop >= slotTop };
  };
  let font = maxFont, lay = fit(font);
  while (!lay.ok && font > 44) { font -= 2; lay = fit(font); }
  return lay;
}

// Render the finished Ascendra label from registry values (1000x968 portrait).
export function buildVialLabelCanvas(vals: VialVals, navy: string = DEFAULT_NAVY): HTMLCanvasElement {
  const PW = 1000, PH = 968;
  const c = document.createElement("canvas");
  c.width = PW; c.height = PH;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH);

  // Vertical caution text, far left.
  x.save(); x.translate(46, 812); x.rotate(-Math.PI / 2);
  x.textAlign = "left"; x.font = "20px Arial"; x.fillStyle = SLATE;
  x.fillText("Not for human, veterinary or diagnostic use.", 0, 0);
  x.restore();

  // Left technical panel: FORMULA / CAS / MW.
  const LX = 96, LW = 200;
  const panel = (lab: string, val: string, y: number, isFormula: boolean) => {
    x.textAlign = "left"; x.font = "700 24px Arial"; x.fillStyle = STEEL; x.fillText(lab, LX, y);
    x.strokeStyle = STEEL; x.lineWidth = 2;
    x.beginPath(); x.moveTo(LX, y + 16); x.lineTo(LX + LW, y + 16); x.stroke();
    if (isFormula) drawFormula(x, val || "", LX, y + 54, 26, navy);
    else { x.font = "26px Arial"; x.fillStyle = navy; x.fillText(val || "", LX, y + 54); }
  };
  panel("FORMULA", vals.formula, 270, true);
  panel("CAS", vals.cas, 455, false);
  panel("MW", vals.mw, 640, false);

  // Vertical divider between the panel and the center.
  x.strokeStyle = navy; x.lineWidth = 2;
  x.beginPath(); x.moveTo(322, 150); x.lineTo(322, 806); x.stroke();

  // Center panel.
  const CX0 = 360, CR = 944, CMID = (CX0 + CR) / 2;

  // A-mark logo (navy chevron + light-blue accent).
  const ax = CMID, ay = 150, s = 46;
  x.fillStyle = navy; x.beginPath();
  x.moveTo(ax, ay - s); x.lineTo(ax + s * 0.9, ay + s * 0.8); x.lineTo(ax + s * 0.5, ay + s * 0.8);
  x.lineTo(ax, ay - s * 0.05); x.lineTo(ax - s * 0.5, ay + s * 0.8); x.lineTo(ax - s * 0.9, ay + s * 0.8);
  x.closePath(); x.fill();
  x.fillStyle = ACCENT; x.beginPath();
  x.moveTo(ax + s * 0.16, ay - s * 0.28); x.lineTo(ax + s * 0.62, ay + s * 0.55); x.lineTo(ax + s * 0.34, ay + s * 0.55);
  x.closePath(); x.fill();

  // ASCENDRA wordmark (letter-spaced) + BIO with side rules.
  x.fillStyle = navy; x.textAlign = "left";
  const word = "ASCENDRA", ls = 8; x.font = "700 40px Arial";
  let tw = 0; for (const ch of word) tw += x.measureText(ch).width + ls; tw -= ls;
  let wx = CMID - tw / 2;
  for (const ch of word) { x.fillText(ch, wx, ay + 92); wx += x.measureText(ch).width + ls; }
  x.textAlign = "center"; x.font = "600 22px Arial"; x.fillText("BIO", CMID, ay + 124);
  const bw = x.measureText("BIO").width; x.strokeStyle = navy; x.lineWidth = 2;
  x.beginPath();
  x.moveTo(CMID - bw / 2 - 46, ay + 117); x.lineTo(CMID - bw / 2 - 14, ay + 117);
  x.moveTo(CMID + bw / 2 + 14, ay + 117); x.lineTo(CMID + bw / 2 + 46, ay + 117);
  x.stroke();

  // Name (one line preferred; wraps + shrinks only when needed).
  x.textAlign = "left"; x.fillStyle = navy;
  const nm = layoutName(x, vals.name, CR - CX0, 320, 452, 88, 54);
  nm.lines.forEach((ln, i) => {
    x.font = `800 ${nm.font}px Arial`;
    x.fillText(ln, CX0, 452 - (nm.lines.length - 1 - i) * nm.lineH);
  });

  // Strength.
  x.font = "700 60px Arial"; x.fillStyle = navy; x.fillText(vals.strength, CX0, 528);

  // PURITY box.
  const py = 560, ph = 76, pw = CR - CX0;
  x.strokeStyle = navy; x.lineWidth = 2; roundRectPath(x, CX0, py, pw, ph, 8); x.stroke();
  x.textBaseline = "middle"; x.font = "700 32px Arial"; x.fillStyle = STEEL; x.textAlign = "left";
  x.fillText("PURITY", CX0 + 28, py + ph / 2 + 2);
  x.font = "30px Arial"; x.fillStyle = navy; x.textAlign = "right";
  x.fillText(PURITY_TEXT, CR - 24, py + ph / 2 + 2); x.textBaseline = "alphabetic";

  // For Research Use Only.
  x.textAlign = "center"; x.font = "26px Arial"; x.fillStyle = SLATE;
  x.fillText("For Research Use Only", CMID, py + ph + 56);

  // Navy LOT | MFG footer.
  x.fillStyle = navy; x.fillRect(0, 882, PW, 86);
  x.fillStyle = "#eef2f8"; x.textBaseline = "middle"; x.textAlign = "left"; x.font = "700 30px Arial";
  if (vals.lot) x.fillText(`LOT: ${vals.lot}`, 70, 927);
  x.strokeStyle = "#8ea6cc"; x.lineWidth = 1; x.beginPath(); x.moveTo(560, 900); x.lineTo(560, 952); x.stroke();
  if (vals.mfg) x.fillText(`MFG: ${vals.mfg}`, 600, 927);
  x.textAlign = "left"; x.textBaseline = "alphabetic";
  return c;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Composite the portrait label onto the vial base with a horizontal cylinder wrap
// (center face-on, edges compressed and gently darkened). Returns the canvas, or
// null if the base image can't load.
export async function buildVialMockupCanvas(
  vals: VialVals,
  navy: string = DEFAULT_NAVY,
  baseSrc = BASE_SRC,
): Promise<HTMLCanvasElement | null> {
  const label = buildVialLabelCanvas(vals, navy);
  const base = await loadImage(baseSrc).catch(() => null);
  if (!base) return null;
  const out = document.createElement("canvas");
  out.width = base.width;
  out.height = base.height;
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(base, 0, 0);

  const { x0, y0, x1, y1 } = VIAL.region;
  const rw = x1 - x0;
  const rh = y1 - y0;
  const half = VIAL.arc / 2;
  const sinHalf = Math.sin(half);
  const drawnH = rh; // fill the full label face so any base placeholder text is covered
  const yTop = y0;
  for (let i = 0; i < rw; i++) {
    const t = rw <= 1 ? 0.5 : i / (rw - 1);
    const theta = (t - 0.5) * VIAL.arc;
    const srcT = (Math.sin(theta) / sinHalf) * 0.5 + 0.5;
    const srcX = Math.max(0, Math.min(label.width - 1, srcT * (label.width - 1)));
    const ox = x0 + i;
    ctx.globalAlpha = 1;
    ctx.drawImage(label, srcX, 0, 1, label.height, ox, yTop, 1, drawnH);
    const e = Math.abs(theta) / half;
    const a = e < 0.55 ? 0 : Math.pow((e - 0.55) / 0.45, 2) * 0.3;
    if (a > 0.001) {
      ctx.globalAlpha = a;
      ctx.fillStyle = "#0a1420";
      ctx.fillRect(ox, yTop, 1, drawnH);
    }
  }
  ctx.globalAlpha = 1;
  return out;
}

export async function buildVialMockupBlob(
  vals: VialVals,
  navy: string = DEFAULT_NAVY,
  baseSrc = BASE_SRC,
): Promise<Blob | null> {
  const canvas = await buildVialMockupCanvas(vals, navy, baseSrc);
  if (!canvas) return null;
  return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
}
