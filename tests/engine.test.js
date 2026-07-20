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
import { describe, it, expect } from "vitest";
import {
  defaults,
  setState,
  traceAll,
  refract,
  setBackwardPropagation,
} from "../src/engine/index.js";

function comp(type, x, y, angle, extra = {}) {
  return Object.assign({
    id: Math.random(),
    type,
    x,
    y,
    angle,
    visible: true,
    p: Object.assign(defaults(type), extra),
  });
}
function trace(comps) {
  setState(comps);
  return traceAll();
}
// helper: segments starting after x0 (post-element), find crossing of y=0
function axisCrossings(segs, xmin) {
  const xs = [];
  for (const s of segs) {
    if (s.y1 > 0 !== s.y2 > 0) {
      const t = s.y1 / (s.y1 - s.y2);
      const x = s.x1 + t * (s.x2 - s.x1);
      if (x > xmin) xs.push(x);
    }
  }
  return xs;
}

describe("thin lens", () => {
  it("1. thin lens 2f→2f imaging: point at s=240, f=120 → image at s'=240", () => {
    const tr = trace([
      comp("pointsrc", -240, 0, 0, { N: 9, div: 6 }),
      comp("lens", 0, 0, 0, { f: 120, sd: 30 }),
    ]);
    const xs = axisCrossings(tr.segs, 1);
    const err = xs.map((x) => Math.abs(x - 240));
    expect(xs.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...err)).toBeLessThan(0.5);
  });

  it("2. thin lens: collimated → focus at back focal point f", () => {
    const tr = trace([
      comp("laser", -300, 0, 0, { N: 5, w: 15 }),
      comp("lens", 0, 0, 0, { f: 100, sd: 30 }),
    ]);
    const xs = axisCrossings(tr.segs, 1);
    expect(xs.length).toBeGreaterThanOrEqual(2);
    xs.forEach((x) => expect(Math.abs(x - 100)).toBeLessThan(1e-6));
  });

  it("3. negative lens: virtual focus behaves as if diverging from (f,0)", () => {
    // ray at h=10, f=-100 → expected slope from virtual point (-100,0) through (0,10): 10/100 = 0.1
    const tr = trace([
      comp("laser", -300, 10, 0, { N: 1, w: 1 }),
      comp("lens", 0, 0, 0, { f: -100, sd: 30 }),
    ]);
    const out = tr.segs.find(
      (s) => s.x1 > -1 && s.x1 < 1 && Math.abs(s.y1 - 10) < 0.1,
    );
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope - 0.1)).toBeLessThan(1e-9);
  });
});

describe("mirrors", () => {
  it("4. concave mirror: collimated → paraxial focus near f=R/2", () => {
    const tr = trace([
      comp("laser", -400, 6, 0, { N: 1, w: 1 }),
      comp("curvedmirror", 0, -6, 0, { R: 200, sd: 26 }),
    ]);
    const refl = tr.segs.find((s) => s.x2 < s.x1); // traveling backwards
    const tc = (-6 - refl.y1) / (refl.y2 - refl.y1);
    const xc = refl.x1 + tc * (refl.x2 - refl.x1);
    // exact (non-paraxial) focus for h=12 off-axis vs. paraxial f=-100 from vertex(~0);
    // spherical aberration is expected, so the tolerance is loose (2.5mm)
    expect(Math.abs(xc - -100)).toBeLessThan(2.5);
  });
});

describe("beamsplitter", () => {
  it("5a. BS splits power: R+T=1 (energy conservation)", () => {
    const tr = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1 }),
      comp("bscube", 0, 0, 0, { R: 0.3 }),
    ]);
    const after = tr.segs.filter((s) => s.x1 > -1);
    const total = after.reduce((a, s) => a + s.pw, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    expect(after.length).toBe(2);
  });

  it("5b. BS reflects 90° for +x input", () => {
    const tr = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1 }),
      comp("bscube", 0, 0, 0, { R: 0.3 }),
    ]);
    const after = tr.segs.filter((s) => s.x1 > -1);
    const refl = after.find((s) => Math.abs(s.x2 - s.x1) < 1e-6);
    expect(refl).toBeTruthy();
    expect(refl.y2).toBeLessThan(refl.y1);
  });
});

describe("spectral mirrors (hot/cold)", () => {
  const powerAfter = (tr, wantReflected) => {
    const after = tr.segs.filter((s) => s.x1 > -1);
    const refl = after.find((s) => Math.abs(s.x2 - s.x1) < 1e-6);
    const trans = after.find((s) => s !== refl);
    return (wantReflected ? refl : trans)?.pw ?? 0;
  };

  it("18a. hot mirror reflects IR (1000nm) and ideally transmits all visible (550nm)", () => {
    const ir = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 1000 }),
      comp("hotmirror", 0, 0, 0, { R: 0.96 }),
    ]);
    expect(powerAfter(ir, true)).toBeCloseTo(0.96, 5);
    expect(powerAfter(ir, false)).toBeCloseTo(0.04, 5);

    // out-of-band (visible): ideal by default (rLow=0) -> 100% transmitted
    const vis = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 550 }),
      comp("hotmirror", 0, 0, 0, { R: 0.96 }),
    ]);
    expect(powerAfter(vis, false)).toBeCloseTo(1, 5);
    expect(powerAfter(vis, true)).toBeCloseTo(0, 5);
  });

  it("18b. cold mirror reflects visible (550nm) and ideally transmits all IR (1000nm)", () => {
    const vis = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 550 }),
      comp("coldmirror", 0, 0, 0, { R: 0.96 }),
    ]);
    expect(powerAfter(vis, true)).toBeCloseTo(0.96, 5);
    expect(powerAfter(vis, false)).toBeCloseTo(0.04, 5);

    const ir = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 1000 }),
      comp("coldmirror", 0, 0, 0, { R: 0.96 }),
    ]);
    expect(powerAfter(ir, false)).toBeCloseTo(1, 5);
    expect(powerAfter(ir, true)).toBeCloseTo(0, 5);
  });

  it("18b2. hot/cold mirror out-of-band reflectance is adjustable via 'rLow'", () => {
    const tr = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 550 }),
      comp("hotmirror", 0, 0, 0, { R: 0.96, rLow: 0.04 }),
    ]);
    expect(powerAfter(tr, false)).toBeCloseTo(0.96, 5);
    expect(powerAfter(tr, true)).toBeCloseTo(0.04, 5);
  });

  it("18c. dichroic edge filter: reflects below its wl cutoff, ideally transmits all above it", () => {
    const below = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 450 }),
      comp("dichroic", 0, 0, 0, { R: 0.9, wl: 550 }),
    ]);
    expect(powerAfter(below, true)).toBeCloseTo(0.9, 5);
    expect(powerAfter(below, false)).toBeCloseTo(0.1, 5);

    const above = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 650 }),
      comp("dichroic", 0, 0, 0, { R: 0.9, wl: 550 }),
    ]);
    // above the cutoff, reflectance is ideal by default (rLow=0), so
    // transmittance is 100% regardless of the in-band peak R
    expect(powerAfter(above, false)).toBeCloseTo(1, 5);
    expect(powerAfter(above, true)).toBeCloseTo(0, 5);

    // moving the cutoff flips which side of the same wavelength reflects
    const moved = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1, wl: 650 }),
      comp("dichroic", 0, 0, 0, { R: 0.9, wl: 700 }),
    ]);
    expect(powerAfter(moved, true)).toBeCloseTo(0.9, 5);
    expect(powerAfter(moved, false)).toBeCloseTo(0.1, 5);
  });
});

describe("Snell refraction", () => {
  it("6. n=1.5, 45° incidence → asin(sin45°/1.5) = 28.13°", () => {
    const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const o = refract(d, -1, 0, 1, 1.5);
    const ang = (Math.atan2(o.y, o.x) * 180) / Math.PI;
    expect(Math.abs(ang - 28.1255)).toBeLessThan(0.01);
  });

  it("7. TIR occurs at 45° glass→air (> critical angle 41.8°)", () => {
    const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const o = refract(d, -1, 0, 1.5, 1); // normal opposing d, n starts inside glass hitting exit face
    expect(o.tir).toBe(true);
  });
});

describe("reduced eye", () => {
  const spreadOf = (tr) => {
    const ys = tr.hits.map((h) => h.y);
    return ys.length ? Math.max(...ys) - Math.min(...ys) : 1e9;
  };

  it("8a. emmetropic eye: tight retinal focus", () => {
    const emm = trace([
      comp("laser", -300, 0, 0, { N: 7, w: 6 }),
      comp("eye", 0, 0, 0, { dz: 0 }),
    ]);
    const sE = spreadOf(emm);
    expect(emm.hits.length).toBeGreaterThanOrEqual(5);
    expect(sE).toBeLessThan(1.2);
  });

  it("8b. myopic eye (+8mm axial offset): retinal blur grows", () => {
    const emm = trace([
      comp("laser", -300, 0, 0, { N: 7, w: 6 }),
      comp("eye", 0, 0, 0, { dz: 0 }),
    ]);
    const sE = spreadOf(emm);
    const myo = trace([
      comp("laser", -300, 0, 0, { N: 7, w: 6 }),
      comp("eye", 0, 0, 0, { dz: 8 }),
    ]);
    const sM = spreadOf(myo);
    expect(sM).toBeGreaterThan(3 * Math.max(sE, 0.05));
  });
});

describe("backward propagation (retina → world)", () => {
  // exiting rays: the long (~DMAX) segments traveling away from the eye, in -x
  const exiting = (tr) => tr.segs.filter((s) => s.x2 < -1000);
  const dirOf = (s) => {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    return { x: (s.x2 - s.x1) / L, y: (s.y2 - s.y1) / L };
  };

  it("8c. emmetropic eye (dz=0): retina point source exits collimated", () => {
    setBackwardPropagation(true);
    const tr = trace([comp("eye", 0, 0, 0, { dz: 0 })]);
    const rays = exiting(tr);
    setBackwardPropagation(false);
    expect(rays.length).toBeGreaterThanOrEqual(5);
    const dirs = rays.map(dirOf);
    // paraxial (near-axis) ray: essentially perfectly collimated
    const axial = dirs[Math.floor(dirs.length / 2)];
    expect(Math.abs(axial.y)).toBeLessThan(1e-6);
    expect(axial.x).toBeLessThan(-0.999);
    // full-aperture spread (marginal rays show some spherical aberration,
    // same as the forward-trace retinal blur in test 8a) stays small
    const spread =
      Math.max(...dirs.map((d) => d.y)) - Math.min(...dirs.map((d) => d.y));
    expect(spread).toBeLessThan(0.06);
  });

  it("8d. myopic eye (dz=+8mm): retina point source exits converging to a finite far point", () => {
    setBackwardPropagation(true);
    const tr = trace([comp("eye", 0, 0, 0, { dz: 8 })]);
    setBackwardPropagation(false);
    const rays = exiting(tr);
    expect(rays.length).toBeGreaterThanOrEqual(5);
    const dirs = rays.map(dirOf);
    const spread =
      Math.max(...dirs.map((d) => d.y)) - Math.min(...dirs.map((d) => d.y));
    expect(spread).toBeGreaterThan(0.01); // not collimated: rays are converging

    // the top- and bottom-most exiting rays should cross the axis at a finite
    // point in front of the eye (dz=+8mm myopia -> a real, finite far point)
    const top = rays.reduce((a, b) => (dirOf(a).y > dirOf(b).y ? a : b));
    const bot = rays.reduce((a, b) => (dirOf(a).y < dirOf(b).y ? a : b));
    const d1 = dirOf(top),
      d2 = dirOf(bot);
    const den = d1.x * d2.y - d1.y * d2.x;
    expect(Math.abs(den)).toBeGreaterThan(1e-6); // not parallel: they do converge
    const t = ((bot.x1 - top.x1) * d2.y - (bot.y1 - top.y1) * d2.x) / den;
    const xCross = top.x1 + d1.x * t;
    expect(Number.isFinite(xCross)).toBe(true);
    expect(xCross).toBeLessThan(-26); // in front of the cornea vertex
  });

  it("8e. the eye's 'wl' parameter carries through backward rays into a downstream spectral mirror", () => {
    // sum reflected/transmitted power just past a hot mirror placed in the
    // backward-exiting beam's path, to prove each ray's wavelength (set by
    // the eye's own 'wl' param) reaches the spectral interaction downstream
    const splitAt = (tr, xHit) => {
      const after = tr.segs.filter((s) => Math.abs(s.x1 - xHit) < 5);
      let refl = 0,
        trans = 0;
      for (const s of after) {
        // reflected branch turns ~90°: |dy| dominates; transmitted keeps
        // going the same way it came: |dx| dominates
        if (Math.abs(s.y2 - s.y1) > Math.abs(s.x2 - s.x1)) refl += s.pw;
        else trans += s.pw;
      }
      return { refl, trans };
    };

    setBackwardPropagation(true);
    const ir = trace([
      comp("eye", 200, 0, 0, { dz: 0, wl: 1000 }),
      comp("hotmirror", 100, 0, 0, { R: 0.9 }),
    ]);
    const irSplit = splitAt(ir, 100);
    setBackwardPropagation(false);
    expect(irSplit.refl + irSplit.trans).toBeGreaterThan(0);
    expect(irSplit.refl / (irSplit.refl + irSplit.trans)).toBeCloseTo(0.9, 1);

    setBackwardPropagation(true);
    const vis = trace([
      comp("eye", 200, 0, 0, { dz: 0, wl: 550 }),
      comp("hotmirror", 100, 0, 0, { R: 0.9 }),
    ]);
    const visSplit = splitAt(vis, 100);
    setBackwardPropagation(false);
    expect(visSplit.refl + visSplit.trans).toBeGreaterThan(0);
    // out-of-band (visible): ideal by default (rLow=0) -> fully transmitted
    expect(visSplit.trans / (visSplit.refl + visSplit.trans)).toBeCloseTo(1, 1);
  });
});

describe("aperture", () => {
  it("9. iris clips rays with |h| > aperture radius", () => {
    const tr = trace([
      comp("laser", -200, 0, 0, { N: 5, w: 12 }),
      comp("iris", 0, 0, 0, { a: 8, sd: 30 }),
      comp("screen", 100, 0, 0),
    ]);
    expect(tr.hits.length).toBe(3);
    tr.hits.forEach((h) => expect(Math.abs(h.y)).toBeLessThanOrEqual(8.01));
  });
});

describe("grating", () => {
  it("10. diffraction orders m=-1,0,+1 satisfy the grating equation", () => {
    const tr = trace([
      comp("laser", -200, 0, 0, { N: 1, w: 1 }),
      comp("grating", 0, 0, 0, { g: 0.4, sd: 28 }),
    ]);
    const after = tr.segs.filter((s) => s.x1 > -0.5);
    const sines = after
      .map((s) => {
        const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
        return +((s.y2 - s.y1) / L).toFixed(6);
      })
      .sort((a, b) => a - b);
    expect(sines.length).toBe(3);
    expect(Math.abs(sines[0] + 0.4)).toBeLessThan(1e-6);
    expect(Math.abs(sines[1])).toBeLessThan(1e-6);
    expect(Math.abs(sines[2] - 0.4)).toBeLessThan(1e-6);
  });
});

describe("4f relay", () => {
  it("11. re-collimates with inverted pupil height", () => {
    const tr = trace([
      comp("laser", -300, 8, 0, { N: 1, w: 1 }),
      comp("lens", 0, 0, 0, { f: 100, sd: 30 }),
      comp("lens", 200, 0, 0, { f: 100, sd: 30 }),
    ]);
    const out = tr.segs.find((s) => s.x1 > 199.9);
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope)).toBeLessThan(1e-9);
    expect(Math.abs(out.y1 + 8)).toBeLessThan(1e-6);
  });
});

describe("myopia-control zoned designs", () => {
  it("12. radial-gradient lens with flat profile Pc=Pe=5D behaves like a 5D lens (f≈200mm)", () => {
    const tr = trace([
      comp("laser", -300, 0, 0, { N: 5, w: 10 }),
      comp("gradlens", 0, 0, 0, { Pc: 5, Pe: 5, q: 2, sd: 22 }),
    ]);
    const xs = axisCrossings(tr.segs, 1);
    expect(xs.length).toBeGreaterThanOrEqual(4);
    xs.forEach((x) => expect(Math.abs(x - 200)).toBeLessThan(3));
  });

  it("13. DIMS clear zone (plano base): ray inside r0 passes undeviated", () => {
    const tr = trace([
      comp("laser", -200, 2, 0, { N: 1, w: 1 }),
      comp("dims", 0, -0, 0, { Pb: 0, Pa: 3.5 }),
    ]);
    const out = tr.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const slope = (out.y2 - out.y1) / (out.x2 - out.x1);
    expect(Math.abs(slope)).toBeLessThan(1e-12);
  });

  it("14a. DIMS lenslet: ray through lenslet center is undeviated", () => {
    const p = {
      Pb: 0,
      Pa: 3.5,
      r0: 4.7,
      dl: 1.03,
      pitch: 1.45,
      r1: 16.5,
      sd: 22,
    };
    const hc = p.r0 + p.dl / 2; // first lenslet center
    const tr1 = trace([
      comp("laser", -200, hc, 0, { N: 1, w: 1 }),
      comp("dims", 0, 0, 0, p),
    ]);
    const o1 = tr1.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const s1 = (o1.y2 - o1.y1) / (o1.x2 - o1.x1);
    expect(Math.abs(s1)).toBeLessThan(1e-12);
  });

  it("14b. DIMS lenslet: off-center ray deflects by (h−hc)·Pa/1000", () => {
    const p = {
      Pb: 0,
      Pa: 3.5,
      r0: 4.7,
      dl: 1.03,
      pitch: 1.45,
      r1: 16.5,
      sd: 22,
    };
    const hc = p.r0 + p.dl / 2,
      dh = 0.4;
    const tr2 = trace([
      comp("laser", -200, hc + dh, 0, { N: 1, w: 1 }),
      comp("dims", 0, 0, 0, p),
    ]);
    const o2 = tr2.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const s2 = (o2.y2 - o2.y1) / (o2.x2 - o2.x1);
    expect(Math.abs(s2 - (-dh * 3.5) / 1000)).toBeLessThan(1e-9);
  });

  it("15. DIMS + eye: lenslet rays focus in front of the retina, clear-zone rays on it", () => {
    const p = {
      Pb: 0,
      Pa: 3.5,
      r0: 4.7,
      dl: 1.03,
      pitch: 1.45,
      r1: 16.5,
      sd: 22,
    };
    const eyeAt = 60;
    const wide = trace([
      comp("laser", -200, 0, 0, { N: 13, w: 7 }),
      comp("dims", 0, 0, 0, p),
      comp("eye", eyeAt, 0, 0, {}),
    ]);
    const xsIn = axisCrossings(wide.segs, eyeAt - 26); // crossings inside the eye
    const retinaX = eyeAt + 26;
    const before = xsIn.filter((x) => x < retinaX - 1.5).length; // foci in front of retina
    const near = xsIn.filter((x) => Math.abs(x - retinaX) < 1.5).length;
    expect(before).toBeGreaterThanOrEqual(1);
    expect(near).toBeGreaterThanOrEqual(1);
  });

  it("16. dual-focus CL: treatment ring adds coaxial power −h(Pb+Pa)/1000", () => {
    const p = { Pb: -3, Pa: 2, r0: 1.65, w: 1.4, sd: 6 };
    const h = p.r0 + 0.5 * p.w;
    const tr = trace([
      comp("laser", -200, h, 0, { N: 1, w: 1 }),
      comp("dfcl", 0, 0, 0, p),
    ]);
    const o = tr.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const slope = (o.y2 - o.y1) / (o.x2 - o.x1);
    expect(Math.abs(slope - (-h * (p.Pb + p.Pa)) / 1000)).toBeLessThan(1e-9);
  });

  it("17a. PAL: distance zone (Pd=0) is undeviated", () => {
    const p = { Pd: 0, add: 2, L: 10, sd: 22 };
    const tr1 = trace([
      comp("laser", -200, -15, 0, { N: 1, w: 1 }),
      comp("pal", 0, 0, 0, p),
    ]);
    const o1 = tr1.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const s1 = (o1.y2 - o1.y1) / (o1.x2 - o1.x1);
    expect(Math.abs(s1)).toBeLessThan(1e-12);
  });

  it("17b. PAL: near zone deflects by −add·h/1000", () => {
    const p = { Pd: 0, add: 2, L: 10, sd: 22 };
    const tr2 = trace([
      comp("laser", -200, 15, 0, { N: 1, w: 1 }),
      comp("pal", 0, 0, 0, p),
    ]);
    const o2 = tr2.segs.find((s) => s.x1 > -0.5 && s.x1 < 1);
    const s2 = (o2.y2 - o2.y1) / (o2.x2 - o2.x1);
    expect(Math.abs(s2 - (-2 * 15) / 1000)).toBeLessThan(1e-9);
  });
});
