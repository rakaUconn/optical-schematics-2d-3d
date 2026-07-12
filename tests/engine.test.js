/**
 * Analytic validation suite for the ray-trace physics engine.
 * Each test checks a traced result against a closed-form optics result
 * (thin-lens equation, Snell's law, grating equation, etc.) — see the
 * validation table in README.md for the full test → expectation mapping.
 *
 * Ported 1:1 from the original test_engine_v3.js (same tolerances and
 * assertions), now importing the engine as an ES module instead of
 * requiring a bundled engine.js, and using Vitest's describe/it/expect.
 */
import { describe, it, expect } from 'vitest';
import { defaults, setState, traceAll, refract } from '../src/engine/index.js';

function comp(type, x, y, angle, extra = {}) {
  return Object.assign({ id: Math.random(), type, x, y, angle, visible: true, p: Object.assign(defaults(type), extra) });
}
function trace(comps) {
  setState(comps);
  return traceAll();
}
// helper: segments starting after x0 (post-element), find crossing of y=0
function axisCrossings(segs, xmin) {
  const xs = [];
  for (const s of segs) {
    if ((s.y1 > 0) !== (s.y2 > 0)) {
      const t = s.y1 / (s.y1 - s.y2);
      const x = s.x1 + t * (s.x2 - s.x1);
      if (x > xmin) xs.push(x);
    }
  }
  return xs;
}

describe('thin lens', () => {
  it('1. thin lens 2f→2f imaging: point at s=240, f=120 → image at s\'=240', () => {
    const tr = trace([comp('pointsrc', -240, 0, 0, { N: 9, div: 6 }), comp('lens', 0, 0, 0, { f: 120, sd: 30 })]);
    const xs = axisCrossings(tr.segs, 1);
    const err = xs.map(x => Math.abs(x - 240));
    expect(xs.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...err)).toBeLessThan(0.5);
  });

  it('2. thin lens: collimated → focus at back focal point f', () => {
    const tr = trace([comp('laser', -300, 0, 0, { N: 5, w: 15 }), comp('lens', 0, 0, 0, { f: 100, sd: 30 })]);
    const xs = axisCrossings(tr.segs, 1);
    expect(xs.length).toBeGreaterThanOrEqual(2);
    xs.forEach(x => expect(Math.abs(x - 100)).toBeLessThan(1e-6));
  });

  it('3. negative lens: virtual focus behaves as if diverging from (f,0)', () => {
    // ray at h=10, f=-100 → expected slope from virtual point (-100,0) through (0,10): 10/100 = 0.1
    const tr = trace([comp('laser', -300, 10, 0, { N: 1, w: 1 }), comp('lens', 0, 0, 0, { f: -100, sd: 30 })]);
    const out = tr.segs.find(s => s.x1 > -1 && s.x1 < 1 && Math.abs(s.y1 - 10) < 0.1);
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope - 0.1)).toBeLessThan(1e-9);
  });
});

describe('mirrors', () => {
  it('4. concave mirror: collimated → paraxial focus near f=R/2', () => {
    const tr = trace([comp('laser', -400, 6, 0, { N: 1, w: 1 }), comp('curvedmirror', 0, -6, 0, { R: 200, sd: 26 })]);
    const refl = tr.segs.find(s => s.x2 < s.x1); // traveling backwards
    const tc = (-6 - refl.y1) / (refl.y2 - refl.y1);
    const xc = refl.x1 + tc * (refl.x2 - refl.x1);
    // exact (non-paraxial) focus for h=12 off-axis vs. paraxial f=-100 from vertex(~0);
    // spherical aberration is expected, so the tolerance is loose (2.5mm)
    expect(Math.abs(xc - (-100))).toBeLessThan(2.5);
  });
});

describe('beamsplitter', () => {
  it('5a. BS splits power: R+T=1 (energy conservation)', () => {
    const tr = trace([comp('laser', -200, 0, 0, { N: 1, w: 1 }), comp('bscube', 0, 0, 0, { R: 0.3 })]);
    const after = tr.segs.filter(s => s.x1 > -1);
    const total = after.reduce((a, s) => a + s.pw, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    expect(after.length).toBe(2);
  });

  it('5b. BS reflects 90° for +x input', () => {
    const tr = trace([comp('laser', -200, 0, 0, { N: 1, w: 1 }), comp('bscube', 0, 0, 0, { R: 0.3 })]);
    const after = tr.segs.filter(s => s.x1 > -1);
    const refl = after.find(s => Math.abs(s.x2 - s.x1) < 1e-6);
    expect(refl).toBeTruthy();
    expect(refl.y2).toBeLessThan(refl.y1);
  });
});

describe('Snell refraction', () => {
  it('6. n=1.5, 45° incidence → asin(sin45°/1.5) = 28.13°', () => {
    const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const o = refract(d, -1, 0, 1, 1.5);
    const ang = Math.atan2(o.y, o.x) * 180 / Math.PI;
    expect(Math.abs(ang - 28.1255)).toBeLessThan(0.01);
  });

  it('7. TIR occurs at 45° glass→air (> critical angle 41.8°)', () => {
    const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const o = refract(d, -1, 0, 1.5, 1); // normal opposing d, n starts inside glass hitting exit face
    expect(o.tir).toBe(true);
  });
});

describe('reduced eye', () => {
  const spreadOf = tr => { const ys = tr.hits.map(h => h.y); return ys.length ? Math.max(...ys) - Math.min(...ys) : 1e9; };

  it('8a. emmetropic eye: tight retinal focus', () => {
    const emm = trace([comp('laser', -300, 0, 0, { N: 7, w: 6 }), comp('eye', 0, 0, 0, { dz: 0 })]);
    const sE = spreadOf(emm);
    expect(emm.hits.length).toBeGreaterThanOrEqual(5);
    expect(sE).toBeLessThan(1.2);
  });

  it('8b. myopic eye (+8mm axial offset): retinal blur grows', () => {
    const emm = trace([comp('laser', -300, 0, 0, { N: 7, w: 6 }), comp('eye', 0, 0, 0, { dz: 0 })]);
    const sE = spreadOf(emm);
    const myo = trace([comp('laser', -300, 0, 0, { N: 7, w: 6 }), comp('eye', 0, 0, 0, { dz: 8 })]);
    const sM = spreadOf(myo);
    expect(sM).toBeGreaterThan(3 * Math.max(sE, 0.05));
  });
});

describe('aperture', () => {
  it('9. iris clips rays with |h| > aperture radius', () => {
    const tr = trace([comp('laser', -200, 0, 0, { N: 5, w: 12 }), comp('iris', 0, 0, 0, { a: 8, sd: 30 }), comp('screen', 100, 0, 0)]);
    expect(tr.hits.length).toBe(3);
    tr.hits.forEach(h => expect(Math.abs(h.y)).toBeLessThanOrEqual(8.01));
  });
});

describe('grating', () => {
  it('10. diffraction orders m=-1,0,+1 satisfy the grating equation', () => {
    const tr = trace([comp('laser', -200, 0, 0, { N: 1, w: 1 }), comp('grating', 0, 0, 0, { g: 0.4, sd: 28 })]);
    const after = tr.segs.filter(s => s.x1 > -0.5);
    const sines = after.map(s => { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); return +((s.y2 - s.y1) / L).toFixed(6); }).sort((a, b) => a - b);
    expect(sines.length).toBe(3);
    expect(Math.abs(sines[0] + 0.4)).toBeLessThan(1e-6);
    expect(Math.abs(sines[1])).toBeLessThan(1e-6);
    expect(Math.abs(sines[2] - 0.4)).toBeLessThan(1e-6);
  });
});

describe('4f relay', () => {
  it('11. re-collimates with inverted pupil height', () => {
    const tr = trace([
      comp('laser', -300, 8, 0, { N: 1, w: 1 }),
      comp('lens', 0, 0, 0, { f: 100, sd: 30 }),
      comp('lens', 200, 0, 0, { f: 100, sd: 30 })
    ]);
    const out = tr.segs.find(s => s.x1 > 199.9);
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope)).toBeLessThan(1e-9);
    expect(Math.abs(out.y1 + 8)).toBeLessThan(1e-6);
  });
});

describe('myopia-control zoned designs', () => {
  it('12. radial-gradient lens with flat profile Pc=Pe=5D behaves like a 5D lens (f≈200mm)', () => {
    const tr = trace([comp('laser', -300, 0, 0, { N: 5, w: 10 }), comp('gradlens', 0, 0, 0, { Pc: 5, Pe: 5, q: 2, sd: 22 })]);
    const xs = axisCrossings(tr.segs, 1);
    expect(xs.length).toBeGreaterThanOrEqual(4);
    xs.forEach(x => expect(Math.abs(x - 200)).toBeLessThan(3));
  });

  it('13. DIMS clear zone (plano base): ray inside r0 passes undeviated', () => {
    const tr = trace([comp('laser', -200, 2, 0, { N: 1, w: 1 }), comp('dims', 0, -0, 0, { Pb: 0, Pa: 3.5 })]);
    const out = tr.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope)).toBeLessThan(1e-12);
  });

  it('14a. DIMS lenslet: ray through lenslet center is undeviated', () => {
    const p = { Pb: 0, Pa: 3.5, r0: 4.7, dl: 1.03, pitch: 1.45, r1: 16.5, sd: 22 };
    const hc = p.r0 + p.dl / 2; // first lenslet center
    const tr1 = trace([comp('laser', -200, hc, 0, { N: 1, w: 1 }), comp('dims', 0, 0, 0, p)]);
    const o1 = tr1.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const s1 = (o1.y2 - o1.y1) / (o1.x2 - o1.x1);
    expect(Math.abs(s1)).toBeLessThan(1e-12);
  });

  it('14b. DIMS lenslet: off-center ray deflects by (h−hc)·Pa/1000', () => {
    const p = { Pb: 0, Pa: 3.5, r0: 4.7, dl: 1.03, pitch: 1.45, r1: 16.5, sd: 22 };
    const hc = p.r0 + p.dl / 2, dh = 0.4;
    const tr2 = trace([comp('laser', -200, hc + dh, 0, { N: 1, w: 1 }), comp('dims', 0, 0, 0, p)]);
    const o2 = tr2.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const s2 = (o2.y2 - o2.y1) / (o2.x2 - o2.x1);
    expect(Math.abs(s2 - (-dh * 3.5 / 1000))).toBeLessThan(1e-9);
  });

  it('15. DIMS + eye: lenslet rays focus in front of the retina, clear-zone rays on it', () => {
    const p = { Pb: 0, Pa: 3.5, r0: 4.7, dl: 1.03, pitch: 1.45, r1: 16.5, sd: 22 };
    const eyeAt = 60;
    const wide = trace([comp('laser', -200, 0, 0, { N: 13, w: 7 }), comp('dims', 0, 0, 0, p), comp('eye', eyeAt, 0, 0, {})]);
    const xsIn = axisCrossings(wide.segs, eyeAt - 26); // crossings inside the eye
    const retinaX = eyeAt + 26;
    const before = xsIn.filter(x => x < retinaX - 1.5).length;  // foci in front of retina
    const near = xsIn.filter(x => Math.abs(x - retinaX) < 1.5).length;
    expect(before).toBeGreaterThanOrEqual(1);
    expect(near).toBeGreaterThanOrEqual(1);
  });

  it('16. dual-focus CL: treatment ring adds coaxial power −h(Pb+Pa)/1000', () => {
    const p = { Pb: -3, Pa: 2, r0: 1.65, w: 1.4, sd: 6 };
    const h = p.r0 + 0.5 * p.w;
    const tr = trace([comp('laser', -200, h, 0, { N: 1, w: 1 }), comp('dfcl', 0, 0, 0, p)]);
    const o = tr.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const slope = (o.y2 - o.y1) / (o.x2 - o.x1);
    expect(Math.abs(slope - (-h * (p.Pb + p.Pa) / 1000))).toBeLessThan(1e-9);
  });

  it('17a. PAL: distance zone (Pd=0) is undeviated', () => {
    const p = { Pd: 0, add: 2, L: 10, sd: 22 };
    const tr1 = trace([comp('laser', -200, -15, 0, { N: 1, w: 1 }), comp('pal', 0, 0, 0, p)]);
    const o1 = tr1.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const s1 = (o1.y2 - o1.y1) / (o1.x2 - o1.x1);
    expect(Math.abs(s1)).toBeLessThan(1e-12);
  });

  it('17b. PAL: near zone deflects by −add·h/1000', () => {
    const p = { Pd: 0, add: 2, L: 10, sd: 22 };
    const tr2 = trace([comp('laser', -200, 15, 0, { N: 1, w: 1 }), comp('pal', 0, 0, 0, p)]);
    const o2 = tr2.segs.find(s => s.x1 > -0.5 && s.x1 < 1);
    const s2 = (o2.y2 - o2.y1) / (o2.x2 - o2.x1);
    expect(Math.abs(s2 - (-2 * 15 / 1000))).toBeLessThan(1e-9);
  });
});
