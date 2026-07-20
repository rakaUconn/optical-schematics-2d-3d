/**
 * Application entry point — wires the engine-backed state store to the
 * 2D SVG editor, properties panel, library panel, header toolbar, and
 * the Three.js 3D view.
 */
import './styles.css';
import { createSvg2D } from './ui/svg2d.js';
import { createPropsPanel } from './ui/props-panel.js';
import { createLibraryPanel } from './ui/library-panel.js';
import { createHeader } from './ui/header.js';
import { createToast } from './ui/toast.js';
import { createRender3D } from './render3d/index.js';
import { onChange, mode, dirty3d, markDirty3dClean } from './ui/state.js';

const $ = id => document.getElementById(id);

const svgEl = $('svg2d');
const view3dEl = $('view3d');
const hintEl = $('hint');
const coordsEl = $('coords');
const toastEl = $('toast');

const toast = createToast(toastEl);
const svg2d = createSvg2D(svgEl, coordsEl);
const propsPanel = createPropsPanel($('propBody'));
createLibraryPanel($('library'));
const render3d = createRender3D(view3dEl);

const HINT2D = 'click a library part → attaches to selected component (follow the light)<br>rays are physically traced · drag: move · wheel: zoom · R: rotate · Del: remove';
const HINT3D = 'drag: orbit · shift-drag / right-drag: pan · wheel: zoom<br>bench and rays generated from the traced 2D layout';

function applyMode(m) {
  svgEl.style.display = m === '2d' ? 'block' : 'none';
  view3dEl.style.display = m === '3d' ? 'block' : 'none';
  hintEl.innerHTML = m === '2d' ? HINT2D : HINT3D;
  if (m === '3d') {
    if (dirty3d) { render3d.build(); markDirty3dClean(); }
    render3d.resize();
    render3d.setAnimating(true);
  } else {
    render3d.setAnimating(false);
    svg2d.render();
  }
}

createHeader(
  {
    tab2d: $('tab2d'), tab3d: $('tab3d'), btnExample: $('btnExample'),
    btnSnap: $('btnSnap'), btnLabels: $('btnLabels'), btnBackward: $('btnBackward'), btnSVG: $('btnSVG'),
    btnJSON: $('btnJSON'), btnImport: $('btnImport'), btnPaste: $('btnPaste'), btnClear: $('btnClear'),
    fileIn: $('fileIn')
  },
  { onModeChange: applyMode, toast }
);

onChange(({ kind }) => {
  svg2d.render();
  if (kind === 'select' || kind === 'full') propsPanel.render();
  if (kind === 'full' && mode === '3d') { render3d.build(); markDirty3dClean(); }
});

new ResizeObserver(() => { svg2d.render(); render3d.resize(); }).observe($('stage'));

hintEl.innerHTML = HINT2D;
svg2d.render();
propsPanel.render();
