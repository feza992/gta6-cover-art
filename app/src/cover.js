// Vice Panels — the cover renderer.
//
// A cover is drawn on one 2D canvas, from a state object and a list of loaded
// photos (HTMLImageElements). No network, no DOM except the canvas passed in.
// Deterministic: the grain pass uses a seeded PRNG, never Math.random, so the
// same state always draws the same pixels.
//
// Layouts are multi-panel poster grids. Every panel takes its own photo, its
// own zoom/pan and its own colour grade. The caption band at the bottom
// carries a kicker, a big Anton title with a sunset gradient fill, a Pacifico
// script subtitle, a credit line and an optional circular launch badge.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
  story: { w: 1080, h: 1920, label: 'Story · 1080 × 1920' },
};

export const GRADES = {
  sunset: { name: 'Sunset', filter: 'saturate(1.35) sepia(0.28) contrast(1.06)', tint: ['#ff8c3c', '#ff2e88'] },
  neon: { name: 'Neon', filter: 'saturate(1.65) hue-rotate(-14deg) contrast(1.12)', tint: ['#00e5ff', '#ff2e88'] },
  noir: { name: 'Noir', filter: 'grayscale(1) contrast(1.32) brightness(1.06)', tint: ['#ffffff', '#1a1a2e'] },
  vice: { name: 'Vice Pink', filter: 'saturate(1.5) hue-rotate(-32deg) contrast(1.06)', tint: ['#ff7ad9', '#7a2eff'] },
  teal: { name: 'Teal Dawn', filter: 'saturate(1.25) hue-rotate(14deg) contrast(1.08)', tint: ['#2effd5', '#0a3a5c'] },
  gold: { name: 'Gold Hour', filter: 'sepia(0.45) saturate(1.55) contrast(1.05)', tint: ['#ffd23f', '#b25a00'] },
};

// A layout is a function of the photo area (x, y, w, h in pixels) returning
// panels: {x, y, w, h, tilt} in pixels. `kind` selects the background painter.
export const LAYOUTS = {
  hero: {
    name: 'Hero + Two', kind: 'grid', panels: 3,
    rects(a) {
      const g = a.w * 0.012;
      const left = a.w * 0.62;
      return [
        { x: a.x, y: a.y, w: left - g / 2, h: a.h, tilt: 0 },
        { x: a.x + left + g / 2, y: a.y, w: a.w - left - g / 2, h: a.h / 2 - g / 2, tilt: 0 },
        { x: a.x + left + g / 2, y: a.y + a.h / 2 + g / 2, w: a.w - left - g / 2, h: a.h / 2 - g / 2, tilt: 0 },
      ];
    },
  },
  grid: {
    name: 'Four Grid', kind: 'grid', panels: 4,
    rects(a) {
      const g = a.w * 0.012;
      const cw = (a.w - g) / 2, ch = (a.h - g) / 2;
      return [
        { x: a.x, y: a.y, w: cw, h: ch, tilt: 0 },
        { x: a.x + cw + g, y: a.y, w: cw, h: ch, tilt: 0 },
        { x: a.x, y: a.y + ch + g, w: cw, h: ch, tilt: 0 },
        { x: a.x + cw + g, y: a.y + ch + g, w: cw, h: ch, tilt: 0 },
      ];
    },
  },
  strip: {
    name: 'Triple Strip', kind: 'grid', panels: 3,
    rects(a) {
      const g = a.w * 0.012;
      const cw = (a.w - 2 * g) / 3;
      return [0, 1, 2].map((i) => ({ x: a.x + i * (cw + g), y: a.y, w: cw, h: a.h, tilt: 0 }));
    },
  },
  solo: {
    name: 'Full Bleed', kind: 'solo', panels: 1,
    rects(a) { return [{ x: a.x, y: a.y, w: a.w, h: a.h, tilt: 0 }]; },
  },
  postcards: {
    name: 'Postcard Stack', kind: 'postcards', panels: 3,
    rects(a) {
      const pw = a.w * 0.42, ph = a.h * 0.66;
      return [
        { x: a.x + a.w * 0.03, y: a.y + a.h * 0.04, w: pw, h: ph, tilt: -0.10 },
        { x: a.x + a.w * 0.31, y: a.y + a.h * 0.10, w: pw, h: ph, tilt: 0.05 },
        { x: a.x + a.w * 0.55, y: a.y + a.h * 0.07, w: pw, h: ph, tilt: -0.04 },
      ];
    },
  },
  filmstrip: {
    name: 'Film Strip', kind: 'filmstrip', panels: 4,
    rects(a) {
      const stripH = a.h * 0.58;
      const sy = a.y + (a.h - stripH) / 2;
      const fw = (a.w * 0.86 - 3 * a.w * 0.014) / 4;
      return [0, 1, 2, 3].map((i) => ({
        x: a.x + a.w * 0.07 + i * (fw + a.w * 0.014),
        y: sy + stripH * 0.16, w: fw, h: stripH * 0.68, tilt: 0,
      }));
    },
  },
};

export const TITLES = [
  'LEONIDA', 'NEON SHORE', 'NIGHT SHIFT', 'PIER PRESSURE',
  'SUNSET HEIST', 'GOLDEN HOUR', 'VICE CITY NIGHTS', 'LAST SCORE',
];
export const SUBTITLES = [
  'two outlaws, one last score',
  'chasing the sun, outrunning the night',
  'every sunset hides a getaway',
  'welcome back to Vice City',
  'no map, no plan, no regrets',
];

export function defaultState() {
  return {
    size: 'square',
    layout: 'hero',
    kicker: 'VICE CITY • EST. 2026',
    title: 'LEONIDA',
    subtitle: 'two outlaws, one last score',
    credit: 'NOVEMBER 19, 2026 — LAUNCH DAY',
    titleScale: 1,
    effects: { grain: true, vignette: true, halftone: false, badge: true },
    panels: [
      { photo: 0, zoom: 1.15, ox: 0, oy: 0, grade: 'sunset' },
      { photo: 1, zoom: 1.15, ox: 0, oy: 0, grade: 'neon' },
      { photo: 2, zoom: 1.15, ox: 0, oy: 0, grade: 'gold' },
      { photo: 0, zoom: 1.15, ox: 0, oy: 0, grade: 'teal' },
    ],
    selected: 0,
  };
}

export function panelCount(state) {
  return LAYOUTS[state.layout].panels;
}

// --- seeded PRNG (mulberry32) so grain is identical on every render -------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Draw one photo into a panel rect, cover-fit, with zoom + pan.
function drawPhoto(ctx, img, rect, panel) {
  if (!img || !img.naturalWidth) return;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const dw = iw * base * panel.zoom;
  const dh = ih * base * panel.zoom;
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * (dw - rect.w) / 2;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * (dh - rect.h) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = GRADES[panel.grade].filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // Grade tint: a soft two-colour wash over the photo.
  const [c1, c2] = GRADES[panel.grade].tint;
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, hexA(c1, 0.16));
  grad.addColorStop(1, hexA(c2, 0.20));
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// --- background painters for the special layouts ---------------------------
function paintPostcardBackdrop(ctx, area) {
  const sky = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
  sky.addColorStop(0, '#ff9a3c');
  sky.addColorStop(0.45, '#ff2e88');
  sky.addColorStop(1, '#2a0a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  // Low sun disc.
  const sx = area.x + area.w * 0.5, sy = area.y + area.h * 0.42;
  const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, area.w * 0.22);
  sun.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
  sun.addColorStop(0.5, 'rgba(255, 190, 90, 0.55)');
  sun.addColorStop(1, 'rgba(255, 150, 60, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, area.w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // Handwritten postcard note under the stack.
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `${Math.max(20, area.h * 0.075)}px Pacifico, cursive`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.shadowColor = 'rgba(255,46,136,0.8)';
  ctx.shadowBlur = area.h * 0.02;
  ctx.fillText('wish you were here', area.x + area.w * 0.5, area.y + area.h * 0.93);
  ctx.restore();
}

function drawPolaroid(ctx, img, rect, panel) {
  const frame = rect.w * 0.045;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(rect.tilt);
  ctx.translate(-rect.w / 2, -rect.h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = rect.w * 0.06;
  ctx.shadowOffsetY = rect.w * 0.02;
  ctx.fillStyle = '#fdfbf6';
  ctx.fillRect(0, 0, rect.w, rect.h);
  ctx.shadowColor = 'transparent';
  const inner = { x: frame, y: frame, w: rect.w - frame * 2, h: rect.h - frame * 2.4 };
  drawPhoto(ctx, img, inner, panel);
  // Tape strip on the top edge.
  ctx.save();
  ctx.translate(rect.w / 2, 2);
  ctx.rotate(0.02);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-rect.w * 0.16, -rect.h * 0.015, rect.w * 0.32, rect.h * 0.045);
  ctx.restore();
  ctx.restore();
}

function paintFilmstripBase(ctx, area) {
  // The strip's dark bed, painted BEFORE the photos so it never covers them.
  const stripH = area.h * 0.58;
  const sy = area.y + (area.h - stripH) / 2;
  const sx = area.x + area.w * 0.03, sw = area.w * 0.94;
  ctx.fillStyle = '#111118';
  ctx.fillRect(sx, sy, sw, stripH);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, sw, stripH);
}

function paintFilmstripHoles(ctx, area) {
  // Sprocket holes, painted AFTER the photos, on top of the strip bed.
  const stripH = area.h * 0.58;
  const sy = area.y + (area.h - stripH) / 2;
  const sx = area.x + area.w * 0.03, sw = area.w * 0.94;
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  const holeW = sw * 0.022, holeH = stripH * 0.09, gap = sw * 0.028;
  for (let x = sx + gap; x < sx + sw - holeW; x += holeW + gap) {
    roundRect(ctx, x, sy + stripH * 0.035, holeW, holeH, 3); ctx.fill();
    roundRect(ctx, x, sy + stripH - holeH - stripH * 0.035, holeW, holeH, 3); ctx.fill();
  }
}

// --- caption band ----------------------------------------------------------
function fitLines(ctx, text, maxW, startSize, maxH) {
  let size = startSize;
  const words = text.split(/\s+/).filter(Boolean);
  for (;;) {
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const blockH = lines.length * size * 1.02;
    if ((widest <= maxW && blockH <= maxH) || size <= 26) return { lines, size };
    size *= 0.92;
  }
}

function drawBadge(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#1d0b2e';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  // Ring text: "LEONIDA • EST 2026 • " around the top arc.
  const ring = 'LEONIDA • EST 2026 • ';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `${Math.max(9, r * 0.17)}px Anton, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const total = ring.length;
  for (let i = 0; i < total; i++) {
    const ang = -Math.PI * 0.78 + (i / total) * Math.PI * 1.56;
    ctx.save();
    ctx.rotate(ang);
    ctx.translate(0, -r * 0.77);
    ctx.fillText(ring[i], 0, 0);
    ctx.restore();
  }
  // Centre sun.
  ctx.fillStyle = '#ff7a18';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(0, -r * 0.06, r * 0.20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBand(ctx, state, W, bandY, bandH) {
  // Deep ink background with a gold rule on top.
  const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  bg.addColorStop(0, '#1d0b2e');
  bg.addColorStop(1, '#0d0518');
  ctx.fillStyle = bg;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, bandY, W, Math.max(3, bandH * 0.015));

  const pad = W * 0.045;
  const maxW = state.effects.badge ? W - pad * 2 - bandH * 0.78 : W - pad * 2;
  const cx = pad + maxW / 2;

  // Kicker.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const kickSize = Math.max(13, bandH * 0.085);
  try { ctx.letterSpacing = `${Math.max(3, kickSize * 0.32)}px`; } catch (e) { /* older canvas */ }
  ctx.font = `${kickSize}px Anton, "Arial Black", sans-serif`;
  ctx.fillStyle = '#ffd23f';
  const kickY = bandY + bandH * 0.13;
  ctx.fillText(state.kicker.toUpperCase(), cx, kickY);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* noop */ }

  // Title: sunset-gradient Anton, auto-fit, up to two lines. The whole
  // title block is capped so a two-line title can never reach the subtitle
  // or the credit line.
  const titleStart = bandH * 0.40 * state.titleScale;
  const titleTop = bandY + bandH * 0.20;
  const { lines, size } = fitLines(ctx, state.title.toUpperCase(), maxW, titleStart, bandH * 0.46);
  const grad = ctx.createLinearGradient(cx - maxW / 2, 0, cx + maxW / 2, 0);
  grad.addColorStop(0, '#ffd23f');
  grad.addColorStop(0.5, '#ff7a18');
  grad.addColorStop(1, '#ff2e88');
  const lineH = size * 1.02;
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  ctx.lineJoin = 'round';
  lines.forEach((line, i) => {
    const y = titleTop + lineH * (i + 0.82);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, y);
  });

  // Script subtitle, neon pink with glow, tucked under the title.
  const subY = titleTop + lineH * lines.length + bandH * 0.10;
  ctx.font = `${Math.max(15, bandH * 0.115)}px Pacifico, cursive`;
  ctx.fillStyle = '#ff5da2';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = bandH * 0.09;
  ctx.fillText(state.subtitle, cx, subY);
  ctx.shadowBlur = 0;

  // Credit line.
  const credSize = Math.max(11, bandH * 0.062);
  try { ctx.letterSpacing = `${Math.max(2, credSize * 0.28)}px`; } catch (e) { /* noop */ }
  ctx.font = `${credSize}px Anton, "Arial Black", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fillText(state.credit.toUpperCase(), cx, bandY + bandH * 0.94);
  try { ctx.letterSpacing = '0px'; } catch (e) { /* noop */ }

  // Launch badge, right side.
  if (state.effects.badge) {
    drawBadge(ctx, W - pad - bandH * 0.30, bandY + bandH * 0.52, bandH * 0.30);
  }
}

// --- effects ---------------------------------------------------------------
function applyGrain(ctx, W, H) {
  const rnd = mulberry32(20261119);
  const count = Math.floor((W * H) / 220);
  for (let i = 0; i < count; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.02 + rnd() * 0.06})` : `rgba(0,0,0,${0.02 + rnd() * 0.06})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
}

function applyVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(10,5,20,0)');
  g.addColorStop(1, 'rgba(10,5,20,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function applyHalftone(ctx, bandY, bandH, W) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bandY, W, bandH);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const step = 15;
  for (let y = bandY + step / 2; y < bandY + bandH; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const r = 1 + 1.6 * (0.5 + 0.5 * Math.sin((x + y) / 26));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// --- main entry ------------------------------------------------------------
export function drawCover(canvas, state, photos) {
  const { w: W, h: H } = SIZES[state.size];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const layout = LAYOUTS[state.layout];
  const bandH = Math.round(H * (state.size === 'story' ? 0.28 : 0.30));
  const bandY = H - bandH;
  const area = { x: 0, y: 0, w: W, h: layout.kind === 'solo' ? H : bandY };

  // Backdrop.
  if (layout.kind === 'postcards') paintPostcardBackdrop(ctx, area);
  else {
    ctx.fillStyle = '#0d0518';
    ctx.fillRect(0, 0, W, H);
  }

  const rects = layout.rects(area);
  const n = panelCount(state);
  if (layout.kind === 'filmstrip') paintFilmstripBase(ctx, area);
  for (let i = 0; i < n; i++) {
    const panel = state.panels[i];
    const img = photos[panel.photo] || null;
    const rect = rects[i];
    if (layout.kind === 'postcards') {
      drawPolaroid(ctx, img, rect, panel);
    } else if (layout.kind === 'filmstrip') {
      drawPhoto(ctx, img, rect, panel);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    } else {
      ctx.save();
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(10, W * 0.008));
      ctx.clip();
      drawPhoto(ctx, img, rect, panel);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(10, W * 0.008));
      ctx.stroke();
    }
  }
  if (layout.kind === 'filmstrip') paintFilmstripHoles(ctx, area);

  // Caption band: for solo it overlays the photo with a dark gradient.
  if (layout.kind === 'solo') {
    const g = ctx.createLinearGradient(0, bandY - bandH * 0.6, 0, H);
    g.addColorStop(0, 'rgba(13,5,24,0)');
    g.addColorStop(0.45, 'rgba(13,5,24,0.82)');
    g.addColorStop(1, 'rgba(13,5,24,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY - bandH * 0.6, W, H - bandY + bandH * 0.6);
  }
  drawBand(ctx, state, W, bandY, bandH);

  if (state.effects.halftone) applyHalftone(ctx, bandY, bandH, W);
  if (state.effects.vignette) applyVignette(ctx, W, H);
  if (state.effects.grain) applyGrain(ctx, W, H);
  return canvas;
}

export function renderCover(state, photos) {
  const canvas = document.createElement('canvas');
  return drawCover(canvas, state, photos);
}
