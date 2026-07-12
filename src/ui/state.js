/**
 * Application (UI) state store. Owns the editable scene (components,
 * selection, view) and keeps the physics engine's copy in sync.
 * This module has no DOM access itself — svg2d.js / render3d wire it to
 * the page — but it does drive the engine's mutable state via setState().
 */
import { defaultsFor, setState as engineSetState } from '../engine/index.js';
import { NAME } from './catalog.js';

export const state = { comps: [], nextId: 1 };
export let sel = null;
export let snap = true;
export let showLabels = true;
export let mode = '2d';
export let view = { x: -650, y: -380, w: 1500, h: 0 };
export let dirty3d = true;

const listeners = new Set();
/**
 * Subscribe to state changes; fn receives {kind}:
 *   'cosmetic' — redraw the 2D scene only (e.g. a label edit; no physics change)
 *   'quiet'    — re-trace + redraw the 2D scene only, skip props-panel/3D rebuild
 *                (used while dragging a slider in the properties panel, so the
 *                panel's own inputs aren't torn down mid-gesture)
 *   'select'   — a different component was selected: redraw 2D + rebuild props panel
 *   'full'     — scene mutated structurally: re-trace, redraw 2D, rebuild props
 *                panel, and rebuild the 3D scene if it's the active view
 */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify(kind) { listeners.forEach(fn => fn({ kind })); }

export function byId(id) { return state.comps.find(c => c.id === id); }

export function setSnap(v) { snap = v; }
export function setShowLabels(v) { showLabels = v; }
export function setMode(m) { mode = m; }
export function setView(v) { view = v; }
export function markDirty3dClean() { dirty3d = false; }

/** A visual-only edit (e.g. typing a label) — no re-trace needed. */
export function cosmetic() { notify('cosmetic'); }

/** Re-trace after a change driven by a properties-panel slider/color input,
 *  without rebuilding the properties panel itself or the 3D scene. */
export function retraceQuiet() {
  engineSetState(state.comps);
  dirty3d = true;
  notify('quiet');
}

/** Change the selected component without touching the trace/3D cache. */
export function select(id) { sel = id; notify('select'); }

/** Call after any structural mutation to the scene: re-syncs the engine and notifies subscribers. */
export function changed() {
  engineSetState(state.comps);
  dirty3d = true;
  notify('full');
}

export function addComp(type) {
  const parent = sel != null ? byId(sel) : state.comps[state.comps.length - 1] || null;
  let x = 0, y = 0, ang = 0;
  if (parent) {
    const th = parent.angle * Math.PI / 180;
    x = parent.x + Math.cos(th) * 150; y = parent.y + Math.sin(th) * 150; ang = parent.angle;
  }
  const c = { id: state.nextId++, type, label: NAME[type], x, y, angle: ang, parentId: parent ? parent.id : null, visible: true, p: defaultsFor(type) };
  state.comps.push(c); sel = c.id; changed();
  return c;
}

export function removeComp(id) {
  state.comps = state.comps.filter(c => c.id !== id);
  state.comps.forEach(c => { if (c.parentId === id) c.parentId = null; });
  if (sel === id) sel = null;
  changed();
}

export function clearState() {
  state.comps = []; state.nextId = 1; sel = null; changed();
}

/** Replace the whole scene (e.g. after importing a JSON file). */
export function loadState(newState) {
  const comps = Array.isArray(newState.comps) ? newState.comps : [];
  comps.forEach(c => { c.p = Object.assign(defaultsFor(c.type), c.p || {}); });
  state.comps = comps;
  state.nextId = newState.nextId ?? (comps.reduce((m, c) => Math.max(m, c.id), 0) + 1);
  sel = null;
  changed();
}
