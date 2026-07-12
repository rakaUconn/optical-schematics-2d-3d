/**
 * Header toolbar: 2D/3D mode tabs, snap/labels toggles, example loader,
 * and JSON/SVG import-export. Delegates mode-specific view work (showing
 * the 3D canvas, building the Three.js scene, updating the hint text) to
 * the onModeChange callback supplied by the app bootstrap.
 */
import { defaultsFor } from '../engine/index.js';
import { NAME } from './catalog.js';
import { state, snap, showLabels, setSnap, setShowLabels, setMode, setView, clearState, loadState, cosmetic, changed } from './state.js';
import { exportSVG } from './svg2d.js';
import { downloadBlob } from './util.js';

export function createHeader(els, { onModeChange, toast }) {
  const { tab2d, tab3d, btnExample, btnSnap, btnLabels, btnSVG, btnJSON, btnImport, btnClear, fileIn } = els;

  function selectMode(m) {
    setMode(m);
    tab2d.classList.toggle('on', m === '2d');
    tab3d.classList.toggle('on', m === '3d');
    onModeChange(m);
  }
  tab2d.onclick = () => selectMode('2d');
  tab3d.onclick = () => selectMode('3d');

  btnSnap.onclick = () => {
    setSnap(!snap);
    btnSnap.textContent = `Snap: ${snap ? 'on' : 'off'}`;
    btnSnap.classList.toggle('on', snap);
  };
  btnLabels.onclick = () => {
    setShowLabels(!showLabels);
    btnLabels.textContent = `Labels: ${showLabels ? 'on' : 'off'}`;
    btnLabels.classList.toggle('on', showLabels);
    cosmetic();
  };
  btnClear.onclick = () => {
    if (confirm('Clear the whole schematic?')) clearState();
  };
  btnJSON.onclick = () => {
    downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'schematic.json');
    toast('JSON exported');
  };
  btnImport.onclick = () => fileIn.click();
  fileIn.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      try {
        const s = JSON.parse(t);
        if (!Array.isArray(s.comps)) throw 0;
        loadState(s);
        toast('Imported');
      } catch { toast('Not a valid schematic JSON'); }
    });
    e.target.value = '';
  };
  btnSVG.onclick = () => {
    const svgDoc = exportSVG();
    if (!svgDoc) { toast('Nothing to export'); return; }
    downloadBlob(new Blob([svgDoc], { type: 'image/svg+xml' }), 'schematic.svg');
    toast('SVG exported — drops straight into PowerPoint / Illustrator');
  };

  /* Example: SLD → BS → iris → DIMS spectacle → reduced eye, 4f SHWFS arm */
  btnExample.onclick = () => {
    state.comps = []; state.nextId = 1;
    const add = (type, x, y, angle, extra = {}, label) => {
      const c = { id: state.nextId++, type, x, y, angle, parentId: null, visible: true, label: label || NAME[type], p: Object.assign(defaultsFor(type), extra) };
      state.comps.push(c);
      return c.id;
    };
    add('sld', -450, 0, 0, { N: 9, w: 8, color: '#ff8a5c' });
    add('bscube', -125, 0, 0, { R: 0.5 });
    add('iris', 0, 0, 0, { a: 8 });
    add('dims', 100, 0, 0, { Pb: 0, Pa: 3.5, r0: 4.7 });
    add('eye', 185, 0, 0, { dz: 0 });
    add('lens', -125, -150, -90, { f: 100, sd: 24 }, 'L1 (f=100)');
    add('pinhole', -125, -250, -90, { a: 2 });
    add('lens', -125, -350, -90, { f: 100, sd: 24 }, 'L2 (f=100)');
    add('shwfs', -125, -462, -90);
    setView({ x: -680, y: -560, w: 1400, h: 0 });
    changed();
    toast('DIMS demo: clear-zone rays focus on the retina; lenslet rays focus in front (myopic defocus)');
  };
}
