/**
 * 2D SVG rendering + pointer/wheel/keyboard interaction for the optics bench.
 * Reads scene state from ./state.js and ray-trace results from the engine.
 */
import { traceAll, PHYS } from '../engine/index.js';
import { state, sel, snap, view, showLabels, byId, select, changed, removeComp, cosmetic, pasteComp } from './state.js';
import { GLYPH } from './glyphs.js';
import { esc } from './util.js';

function raysSVG() {
  const tr = traceAll(); let o = '';
  for (const s of tr.segs)
    o += `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke="${s.col}" stroke-width="1.3" opacity="${(0.05 + 0.75 * Math.min(1, s.pw)).toFixed(2)}"/>`;
  for (const h of tr.hits)
    o += `<circle cx="${h.x.toFixed(2)}" cy="${h.y.toFixed(2)}" r="2.2" fill="${h.col}" opacity="0.9"/>`;
  return `<g>${o}</g>`;
}
function compNodes(selectedId = sel) {
  let out = '';
  for (const c of state.comps) {
    if (!c.visible) continue;
    let labelText = c.label;
    if (PHYS[c.type]?.act === 'lens' && c.p.f) {
      labelText += ` (f=${c.p.f})`;
    }
    const selMark = (c.id === selectedId) ? `<circle class="selglow" r="46"/>` : '';
    const lab = showLabels ? `<text class="clabel" x="${c.label_x || 0}" y="${c.label_y || 58}" transform="rotate(${-c.angle})">${esc(labelText)}</text>` : '';
    out += `<g class="comp" data-id="${c.id}" transform="translate(${c.x},${c.y}) rotate(${c.angle})">${selMark}${GLYPH[c.type] || ''}${lab}</g>`;
  }
  return out;
}
function gridDefs() {
  return `<defs><pattern id="holes" width="25.4" height="25.4" patternUnits="userSpaceOnUse"><circle cx="12.7" cy="12.7" r="1.1" fill="#26303c"/></pattern><linearGradient id="rain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f7fff"/><stop offset=".5" stop-color="#7ee08a"/><stop offset="1" stop-color="#ff5252"/></linearGradient></defs>`;
}

/** Serializes the current 2D scene (grid excluded) as a standalone SVG document, for export. */
export function exportSVG() {
  if (!state.comps.length) return null;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const grow = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  state.comps.forEach(c => { if (c.visible) { grow(c.x - 70, c.y - 70); grow(c.x + 70, c.y + 70); } });
  traceAll().segs.forEach(s => { grow(s.x1, s.y1); /* keep escaping rays from blowing up the bbox */ });
  const styles = `<style>.comp .body{stroke:#1c232b;fill:none;stroke-width:1.6}.comp .glass{fill:rgba(80,150,235,.18);stroke:#3a7bd5;stroke-width:1.6}.comp .metal{fill:#c9d2dc;stroke:#454f5a;stroke-width:1.6}.comp .dark{fill:#39424d;stroke:#1c232b;stroke-width:1.6}.comp .tint{fill:rgba(230,150,40,.22);stroke:#d98a20;stroke-width:1.6}.comp text{fill:#5a6673;font-family:Helvetica,Arial;font-size:10px;text-anchor:middle}.comp .clabel{font-size:11px}</style>`;
  const gd = `<defs><linearGradient id="rain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f7fff"/><stop offset=".5" stop-color="#40b060"/><stop offset="1" stop-color="#e03030"/></linearGradient></defs>`;
  const nodes = compNodes(null); // no selection glow in the exported file
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" width="${maxX - minX}" height="${maxY - minY}">${styles}${gd}${raysSVG()}${nodes}</svg>`;
}

/**
 * Attaches the 2D view to an <svg> element and returns { render }.
 * coordsEl (optional) receives live cursor coordinates/zoom text.
 */
export function createSvg2D(svg, coordsEl) {
  function render() {
    const aspect = svg.clientHeight / Math.max(1, svg.clientWidth);
    view.h = view.w * aspect;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.innerHTML = gridDefs()
      + `<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#holes)"/>`
      + raysSVG() + compNodes();
  }

  let drag = null;
  function evtWorld(e) {
    const r = svg.getBoundingClientRect();
    return { x: view.x + (e.clientX - r.left) / r.width * view.w, y: view.y + (e.clientY - r.top) / r.height * view.h };
  }
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    const g = e.target.closest('.comp');
    const l = e.target.closest('.clabel');
    const w = evtWorld(e);
    if (l && g) {
      const id = +g.dataset.id, c = byId(id);
      select(id);
      const dx = w.x - c.x;
      const dy = w.y - c.y;
      const th = c.angle * Math.PI / 180;
      const lx = dx * Math.cos(-th) - dy * Math.sin(-th);
      const ly = dx * Math.sin(-th) + dy * Math.cos(-th);
      drag = { mode: 'label', id, offX: (c.label_x || 0) - lx, offY: (c.label_y || 58) - ly };
    } else if (g) {
      const id = +g.dataset.id, c = byId(id);
      select(id);
      drag = { mode: 'comp', id, offX: c.x - w.x, offY: c.y - w.y };
    } else {
      drag = { mode: 'pan', px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
      svg.classList.add('dragging');
    }
  });
  svg.addEventListener('pointermove', e => {
    const w = evtWorld(e);
    if (coordsEl) coordsEl.textContent = `x ${w.x.toFixed(0)}  y ${w.y.toFixed(0)} mm  ·  zoom ${(1500 / view.w).toFixed(2)}×`;
    if (!drag) return;
    if (drag.mode === 'pan') {
      const r = svg.getBoundingClientRect();
      view.x = drag.vx - (e.clientX - drag.px) / r.width * view.w;
      view.y = drag.vy - (e.clientY - drag.py) / r.height * view.h;
      render();
    } else if (drag.mode === 'label') {
      const c = byId(drag.id); if (!c) return;
      const w = evtWorld(e);
      const dx = w.x - c.x;
      const dy = w.y - c.y;
      const th = c.angle * Math.PI / 180;
      const lx = dx * Math.cos(-th) - dy * Math.sin(-th);
      const ly = dx * Math.sin(-th) + dy * Math.cos(-th);
      c.label_x = lx + drag.offX;
      c.label_y = ly + drag.offY;
      cosmetic();
    } else {
      const c = byId(drag.id); if (!c) return;
      let nx = w.x + drag.offX, ny = w.y + drag.offY;
      if (snap) { nx = Math.round(nx / 12.5) * 12.5; ny = Math.round(ny / 12.5) * 12.5; }
      if (nx !== c.x || ny !== c.y) { c.x = nx; c.y = ny; changed(); }
    }
  });
  svg.addEventListener('pointerup', e => {
    if (drag && drag.mode === 'pan' && Math.abs(e.clientX - drag.px) < 3 && Math.abs(e.clientY - drag.py) < 3) {
      select(null);
    }
    drag = null; svg.classList.remove('dragging');
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const w = evtWorld(e), f = Math.exp(e.deltaY * 0.0012);
    const nw = Math.min(9000, Math.max(150, view.w * f)), k = nw / view.w;
    view.x = w.x - (w.x - view.x) * k; view.y = w.y - (w.y - view.y) * k; view.w = nw;
    render();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      pasteComp();
      return;
    }
    if (sel == null) return;
    const c = byId(sel); if (!c) return;
    if (e.key === 'Delete' || e.key === 'Backspace') removeComp(sel);
    else if (e.key === 'r' || e.key === 'R') { c.angle = (c.angle + 45) % 360; changed(); }
  });

  return { render };
}
