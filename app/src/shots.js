// Vice Panels — screenshot scenes for the maker.
//
// ?shot=cover renders one exported cover full-window (the app's own drawing
// of the cover, at the size the query asks for); ?shot=editor opens the
// editor with the sample photos loaded. Both wait for the fonts and the
// photos, then set document.title to "shot-ready" so a headless screenshot
// knows the scene is painted.
//
//   ?shot=cover&layout=hero&size=square&title=LEONIDA
//   ?shot=editor&layout=grid&size=wide

import { SIZES, LAYOUTS, drawCover } from './cover.js';

function params() {
  return new URLSearchParams(window.location.search);
}

async function waitForApp() {
  for (let i = 0; i < 100; i++) {
    if (window.VicePanels && window.VicePanels.photos.length >= 3) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function shotCover(q) {
  const layout = LAYOUTS[q.get('layout')] ? q.get('layout') : 'hero';
  const size = SIZES[q.get('size')] ? q.get('size') : 'square';
  const state = window.VicePanels.state;
  state.layout = layout;
  state.size = size;
  if (q.get('title')) state.title = q.get('title');
  if (q.get('subtitle')) state.subtitle = q.get('subtitle');
  if (q.get('kicker')) state.kicker = q.get('kicker');
  if (q.get('grade')) {
    for (const p of state.panels) p.grade = q.get('grade');
  }
  document.body.classList.add('shot-cover');
  const canvas = document.getElementById('shotCanvas');
  canvas.style.display = 'block';
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch (e) { /* fall back to system sans */ }
  drawCover(canvas, state, window.VicePanels.photos.map((p) => p.img));
  document.title = 'shot-ready';
}

async function shotEditor(q) {
  const next = {};
  const layout = q.get('layout');
  const size = q.get('size');
  if (layout && LAYOUTS[layout]) next.layout = layout;
  if (size && SIZES[size]) next.size = size;
  if (q.get('title')) next.title = q.get('title');
  if (Object.keys(next).length) window.VicePanels.setState(next);
  else window.VicePanels.render();
  document.title = 'shot-ready';
}

(async () => {
  const q = params();
  const shot = q.get('shot');
  if (!shot) return;
  await waitForApp();
  if (shot === 'cover') await shotCover(q);
  else if (shot === 'editor') await shotEditor(q);
})();
