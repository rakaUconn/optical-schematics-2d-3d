import { PHYS } from './physics.js';

/** Returns the default parameter object {key: value, ...} for a component type. */
export function defaultsFor(type) {
  const p = {};
  (PHYS[type]?.params || []).forEach(([k, , , , , d]) => { p[k] = d; });
  if (PHYS[type]?.src) p.color = PHYS[type].color;
  return p;
}
