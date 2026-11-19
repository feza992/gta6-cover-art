// Vice Panels — the editor.
//
// Owns the state, the photo library, the controls and the live preview.
// Photos live on the person's own machine: user photos are read with
// FileReader into memory and never uploaded anywhere.

import {
  SIZES, GRADES, LAYOUTS, TITLES, SUBTITLES,
  defaultState, panelCount, drawCover, renderCover,
} from './cover.js';

const $ = (id) => document.getElementById(id);
const SAMPLES = [
  { name: 'convertible.jpg', src: 'samples/convertible.jpg' },
  { name: 'neon.jpg', src: 'samples/neon.jpg' },
  { name: 'pier.jpg', src: 'samples/pier.jpg' },
];

let state = defaultState();
let photos = []; // {name, img}
let history = [];
let future = [];
let renderQueued = false;

function snapshot() {
  return JSON.parse(JSON.stringify({
    size: state.size, layout: state.layout,
    kicker: state.kicker, title: state.title, subtitle: state.subtitle,
    credit: state.credit, titleScale: state.titleScale,
    effects: state.effects, panels: state.panels, selected: state.selected,
  }));
}

function restore(snap) {
  state = { ...state, ...JSON.parse(JSON.stringify(snap)) };
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 40) history.shift();
  future = [];
  syncUndoButtons();
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
  syncAll();
  syncUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
  syncAll();
  syncUndoButtons();
}

function syncUndoButtons() {
  $('undoBtn').disabled = !history.length;
  $('redoBtn').disabled = !future.length;
}

// --- rendering -------------------------------------------------------------
function render() {
  const canvas = $('preview');
  drawCover(canvas, state, photos.map((p) => p.img));
  $('sizeNote').textContent = `${SIZES[state.size].label} · ${LAYOUTS[state.layout].name} · ${panelCount(state)} panels`;
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

// --- photos ----------------------------------------------------------------
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    if (photos.some((p) => p.name === s.name)) continue;
    const img = await loadImage(s.src);
    if (img) photos.push({ name: s.name, img });
  }
  renderPhotoBar();
  queueRender();
}

function addUserPhotos(files) {
  const readers = [...files].filter((f) => f.type.startsWith('image/'));
  if (!readers.length) return;
  pushHistory();
  let pending = readers.length;
  for (const file of readers) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        photos.push({ name: file.name, img });
        if (--pending === 0) { renderPhotoBar(); queueRender(); }
      };
      img.onerror = () => { if (--pending === 0) { renderPhotoBar(); queueRender(); } };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
}

function renderPhotoBar() {
  const bar = $('photoBar');
  bar.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'thumb';
    b.type = 'button';
    b.title = `${p.name} — click to put it in the selected panel`;
    const usedBy = state.panels
      .map((pl, pi) => (pl.photo === i ? pi + 1 : null))
      .filter((x) => x !== null);
    b.innerHTML = `<img src="${p.img.src}" alt=""><span>${i + 1} · ${p.name}</span>` +
      (usedBy.length ? `<em>in panel ${usedBy.join(', ')}</em>` : '');
    b.addEventListener('click', () => {
      pushHistory();
      state.panels[state.selected].photo = i;
      renderPhotoBar();
      queueRender();
    });
    bar.appendChild(b);
  });
}

// --- controls --------------------------------------------------------------
function buildPickers() {
  // Layouts.
  const layoutBox = $('layoutBox');
  for (const [key, l] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.type = 'button';
    b.textContent = `${l.name} · ${l.panels}`;
    b.dataset.layout = key;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = key;
      state.selected = 0;
      syncAll();
      queueRender();
    });
    layoutBox.appendChild(b);
  }
  // Sizes.
  const sizeBox = $('sizeBox');
  for (const [key, s] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.className = 'pick';
    b.type = 'button';
    b.textContent = s.label;
    b.dataset.size = key;
    b.addEventListener('click', () => {
      pushHistory();
      state.size = key;
      syncAll();
      queueRender();
    });
    sizeBox.appendChild(b);
  }
  // Grades for the selected panel.
  const gradeBox = $('gradeBox');
  for (const [key, g] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.className = 'pick grade';
    b.type = 'button';
    b.textContent = g.name;
    b.dataset.grade = key;
    b.style.setProperty('--g1', g.tint[0]);
    b.style.setProperty('--g2', g.tint[1]);
    b.addEventListener('click', () => {
      pushHistory();
      state.panels[state.selected].grade = key;
      syncAll();
      queueRender();
    });
    gradeBox.appendChild(b);
  }
}

function bindInputs() {
  const text = (id, key) => {
    $(id).addEventListener('input', (e) => { state[key] = e.target.value; queueRender(); });
    $(id).addEventListener('change', () => pushHistory());
  };
  text('kickerIn', 'kicker');
  text('titleIn', 'title');
  text('subtitleIn', 'subtitle');
  text('creditIn', 'credit');

  $('titleScale').addEventListener('input', (e) => {
    state.titleScale = Number(e.target.value);
    $('titleScaleVal').textContent = `${Math.round(state.titleScale * 100)}%`;
    queueRender();
  });
  $('titleScale').addEventListener('change', () => pushHistory());

  const panel = state.panels[state.selected];
  $('zoomIn').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    $('zoomVal').textContent = `${state.panels[state.selected].zoom.toFixed(2)}×`;
    queueRender();
  });
  $('zoomIn').addEventListener('change', () => pushHistory());
  $('panXIn').addEventListener('input', (e) => {
    state.panels[state.selected].ox = Number(e.target.value);
    queueRender();
  });
  $('panXIn').addEventListener('change', () => pushHistory());
  $('panYIn').addEventListener('input', (e) => {
    state.panels[state.selected].oy = Number(e.target.value);
    queueRender();
  });
  $('panYIn').addEventListener('change', () => pushHistory());
  void panel;

  for (const [key, id] of [['grain', 'grainCk'], ['vignette', 'vigCk'], ['halftone', 'halfCk'], ['badge', 'badgeCk']]) {
    $(id).addEventListener('change', (e) => {
      pushHistory();
      state.effects[key] = e.target.checked;
      queueRender();
    });
  }

  $('addPhotos').addEventListener('change', (e) => {
    addUserPhotos(e.target.files);
    e.target.value = '';
  });
  $('samplesBtn').addEventListener('click', () => { pushHistory(); loadSamples(); });
  $('shuffleBtn').addEventListener('click', shuffle);
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('exportBtn').addEventListener('click', () => exportPng(state.size));
  $('exportAllBtn').addEventListener('click', exportAll);
}

function shuffle() {
  pushHistory();
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.title = TITLES[Math.floor(Math.random() * TITLES.length)];
  state.subtitle = SUBTITLES[Math.floor(Math.random() * SUBTITLES.length)];
  state.titleScale = 0.9 + Math.random() * 0.25;
  for (const p of state.panels) {
    p.grade = grades[Math.floor(Math.random() * grades.length)];
    p.zoom = 1.05 + Math.random() * 0.3;
  }
  state.selected = 0;
  syncAll();
  queueRender();
}

// --- export ----------------------------------------------------------------
function download(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

function exportPng(sizeKey) {
  const keep = state.size;
  state.size = sizeKey;
  const canvas = renderCover(state, photos.map((p) => p.img));
  const slug = (state.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  download(canvas, `vice-panels-${slug}-${sizeKey}.png`);
  state.size = keep;
  render();
}

async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    exportPng(key);
    await new Promise((r) => setTimeout(r, 400));
  }
}

// --- preview interaction: click to select, drag to pan, wheel to zoom ------
function previewGeom() {
  const canvas = $('preview');
  const rect = canvas.getBoundingClientRect();
  const { w: W, h: H } = SIZES[state.size];
  const layout = LAYOUTS[state.layout];
  const bandH = Math.round(H * (state.size === 'story' ? 0.28 : 0.30));
  const area = { x: 0, y: 0, w: W, h: layout.kind === 'solo' ? H : H - bandH };
  return { canvas, rect, W, H, rects: layout.rects(area) };
}

function eventPoint(e) {
  const { canvas, rect, W } = previewGeom();
  const scale = W / rect.width;
  return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, canvas };
}

function hitPanel(x, y) {
  const { rects } = previewGeom();
  const n = panelCount(state);
  for (let i = n - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindPreview() {
  const canvas = $('preview');
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const p = eventPoint(e);
    const i = hitPanel(p.x, p.y);
    if (i < 0) return;
    if (i !== state.selected) { state.selected = i; syncAll(); }
    const panel = state.panels[i];
    drag = { i, x: p.x, y: p.y, ox: panel.ox, oy: panel.oy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = eventPoint(e);
    const panel = state.panels[drag.i];
    const img = photos[panel.photo] ? photos[panel.photo].img : null;
    if (!img) return;
    const { rects } = previewGeom();
    const r = rects[drag.i];
    const base = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const dw = img.naturalWidth * base * panel.zoom;
    const dh = img.naturalHeight * base * panel.zoom;
    const dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    panel.ox = clamp(drag.ox + (2 * dx) / Math.max(1, dw - r.w), -1, 1);
    panel.oy = clamp(drag.oy + (2 * dy) / Math.max(1, dh - r.h), -1, 1);
    queueRender();
    syncPanelInputs();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && drag.moved) pushHistory();
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = eventPoint(e);
    const i = hitPanel(p.x, p.y);
    if (i < 0) return;
    pushHistory();
    const panel = state.panels[i];
    panel.zoom = clamp(panel.zoom * Math.exp(-e.deltaY * 0.0012), 1, 3);
    state.selected = i;
    syncAll();
    queueRender();
  }, { passive: false });
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// --- sync UI from state ----------------------------------------------------
function syncPanelInputs() {
  const p = state.panels[state.selected];
  $('zoomIn').value = p.zoom;
  $('zoomVal').textContent = `${p.zoom.toFixed(2)}×`;
  $('panXIn').value = p.ox;
  $('panYIn').value = p.oy;
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount(state)}`;
  document.querySelectorAll('#gradeBox .pick').forEach((b) => {
    b.classList.toggle('on', b.dataset.grade === p.grade);
  });
}

function syncAll() {
  document.querySelectorAll('#layoutBox .pick').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#sizeBox .pick').forEach((b) => {
    b.classList.toggle('on', b.dataset.size === state.size);
  });
  $('kickerIn').value = state.kicker;
  $('titleIn').value = state.title;
  $('subtitleIn').value = state.subtitle;
  $('creditIn').value = state.credit;
  $('titleScale').value = state.titleScale;
  $('titleScaleVal').textContent = `${Math.round(state.titleScale * 100)}%`;
  $('grainCk').checked = state.effects.grain;
  $('vigCk').checked = state.effects.vignette;
  $('halfCk').checked = state.effects.halftone;
  $('badgeCk').checked = state.effects.badge;
  renderPhotoBar();
  syncPanelInputs();
}

// --- boot ------------------------------------------------------------------
async function boot() {
  buildPickers();
  bindInputs();
  bindPreview();
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch (e) { /* fonts fall back to system sans */ }
  await loadSamples();
  syncAll();
  render();
}

window.VicePanels = {
  get state() { return state; },
  get photos() { return photos; },
  setState(next) { pushHistory(); state = { ...state, ...next }; syncAll(); queueRender(); },
  render,
  renderCover,
  loadSamples,
};

boot();
