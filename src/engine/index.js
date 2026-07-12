/**
 * Public API of the ray-trace physics engine.
 * This module (and everything it imports) has zero DOM dependencies —
 * it can run in Node, a worker, or a browser with no globals beyond
 * standard JS math.
 */
export { PHYS } from './physics.js';
export { defaultsFor, defaultsFor as defaults } from './defaults.js';
export {
  setState,
  getState,
  invalidate,
  traceAll,
  refract,
  zoneDefl,
  zonePower,
  EPS,
  DMAX
} from './trace.js';
