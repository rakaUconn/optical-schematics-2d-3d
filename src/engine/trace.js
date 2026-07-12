/**
 * RAY-TRACING ENGINE (2D, non-sequential, exact) — pure math, no DOM.
 *
 * Surfaces: seg {ax,ay,bx,by,nx,ny}, arc {cx,cy,r,a0,a1}
 * Actions: lens, mirror, cmirror(arc), bs, grating, prism(refract),
 *          aperture(block blades), atten, absorb, zone, eye(refract+retina)
 */
import { PHYS } from './physics.js';

export const EPS = 1e-3;
export const DMAX = 4000;

// ---- module-local scene state --------------------------------------------
let _comps = [];
let _cache = null;

/** Load the component list to trace against. Resets the memoized trace. */
export function setState(comps) {
  _comps = Array.isArray(comps) ? comps : [];
  _cache = null;
}

export function getState() {
  return _comps;
}

/** Invalidate the memoized trace without changing the component list. */
export function invalidate() {
  _cache = null;
}

// ---- local-frame geometry helpers -----------------------------------------
function rot(c) {
  const th = c.angle * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
  return {
    pt: (lx, ly) => ({ x: c.x + lx * co - ly * si, y: c.y + lx * si + ly * co }),
    vec: (lx, ly) => ({ x: lx * co - ly * si, y: lx * si + ly * co }),
    th
  };
}
function seg(T, ax, ay, bx, by, act) {
  const A = T.pt(ax, ay), B = T.pt(bx, by);
  let nx = -(B.y - A.y), ny = B.x - A.x;
  const L = Math.hypot(nx, ny) || 1;
  return { kind: 'seg', ax: A.x, ay: A.y, bx: B.x, by: B.y, nx: nx / L, ny: ny / L, act };
}
function arc(T, lcx, lcy, r, la0, la1, act) { // local center + local angle span; add comp rotation
  const C = T.pt(lcx, lcy);
  return { kind: 'arc', cx: C.x, cy: C.y, r, a0: la0 + T.th, a1: la1 + T.th, act };
}
function surfacesOf(c) {
  const d = PHYS[c.type]; if (!d || !d.act) return [];
  const T = rot(c), p = c.p, S = [];
  switch (d.act) {
    case 'lens': { const a = T.vec(1, 0); S.push(seg(T, 0, -p.sd, 0, p.sd, { t: 'lens', f: p.f, ax: a.x, ay: a.y, cx: c.x, cy: c.y })); break; }
    case 'mirror': S.push(seg(T, 0, -p.sd, 0, p.sd, { t: 'mirror' })); break;
    case 'cmirror': { const R = p.R, ph = Math.asin(Math.min(0.999, p.sd / R)); S.push(arc(T, -R, 0, R, -ph, ph, { t: 'mirror' })); break; }
    case 'bs': { const h = c.type === 'bscube' ? 20 : 15; S.push(seg(T, -h, h, h, -h, { t: 'bs', R: p.R })); break; }
    case 'grating': S.push(seg(T, 0, -p.sd, 0, p.sd, { t: 'grating', g: p.g })); break;
    case 'prism': {
      const V = [[0, -26], [23, 20], [-23, 20]], cen = { x: 0, y: 4.7 };
      for (let i = 0; i < 3; i++) {
        const a = V[i], b = V[(i + 1) % 3];
        const s = seg(T, a[0], a[1], b[0], b[1], { t: 'refract', n: p.n });
        const mid = T.pt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), cw = T.pt(cen.x, cen.y);
        if ((mid.x - cw.x) * s.nx + (mid.y - cw.y) * s.ny < 0) { s.nx *= -1; s.ny *= -1; }
        S.push(s);
      } break;
    }
    case 'aperture': S.push(seg(T, 0, -p.sd, 0, -p.a, { t: 'block' }), seg(T, 0, p.a, 0, p.sd, { t: 'block' })); break;
    case 'atten': S.push(seg(T, 0, -24, 0, 24, { t: 'atten', T: p.T })); break;
    case 'absorb': { const [fx, fh] = d.face; S.push(seg(T, fx, -fh, fx, fh, { t: 'absorb' })); break; }
    case 'eye': {
      const R = 26, rc = p.rc, pu = Math.min(p.pu, rc * 0.95);
      const phc = Math.asin(pu / rc);                          // cornea span (about local π)
      S.push(arc(T, -R + rc, 0, rc, Math.PI - phc, Math.PI + phc, { t: 'refract', n: 1.336 }));
      const phr = 75 * Math.PI / 180;                          // retina span (about local 0)
      S.push(arc(T, p.dz, 0, R, -phr, phr, { t: 'absorb' }));
      const phf = Math.asin(Math.min(0.999, (pu + 2) / R));    // sclera blocks the rest
      S.push(arc(T, 0, 0, R, phr, Math.PI - phf, { t: 'block' }));
      S.push(arc(T, 0, 0, R, Math.PI + phf, 2 * Math.PI - phr, { t: 'block' }));
      break;
    }
    case 'zone': {
      const a = T.vec(1, 0), u = T.vec(0, 1);
      S.push(seg(T, 0, -p.sd, 0, p.sd, Object.assign({ t: 'zone', design: d.design, ax: a.x, ay: a.y, ux: u.x, uy: u.y, cx: c.x, cy: c.y }, p)));
      break;
    }
  }
  return S;
}

/* Zoned phase elements (myopia-control designs).
   zoneDefl(a,h): transverse ray deflection = dφ/dh (radians), h in mm, powers in D.
   Lenslets deflect about their own centers (h−hc)·Pa; coaxial zones about the
   lens axis h·P; continuous profiles integrate the local power. */
export function zoneDefl(a, h) {
  const s = h < 0 ? -1 : 1, r = Math.abs(h);
  switch (a.design) {
    case 'pal': {
      const h1 = -a.L / 2, h2 = a.L / 2; let g = a.Pd * h;
      if (h > h2) g += a.add * (h - (h1 + h2) / 2);
      else if (h > h1) g += a.add / (h2 - h1) * (h - h1) * (h - h1) / 2;
      return g / 1000;
    }
    case 'dfcl': { const inT = r > a.r0 && Math.floor((r - a.r0) / a.w) % 2 === 0; return h * (a.Pb + (inT ? a.Pa : 0)) / 1000; }
    case 'dims': case 'hal': {
      let g = h * a.Pb;
      const pitch = a.design === 'hal' ? a.dl : a.pitch;
      const r1 = a.design === 'hal' ? a.r0 + a.rings * a.dl : a.r1;
      if (r > a.r0 && r < Math.min(r1, a.sd)) {
        const q = (r - a.r0) % pitch, idx = Math.floor((r - a.r0) / pitch);
        if (a.design === 'hal' || q < a.dl) { const hc = s * (a.r0 + idx * pitch + a.dl / 2); g += (h - hc) * a.Pa; }
      }
      return g / 1000;
    }
    case 'grad': {
      const dp = a.Pe - a.Pc;
      return (a.Pc * h + s * dp * Math.pow(r, a.q + 1) / ((a.q + 1) * Math.pow(a.sd, a.q))) / 1000;
    }
  }
  return 0;
}
/** Local power P(h) in diopters — used by the properties panel's profile plot. */
export function zonePower(a, h) {
  const r = Math.abs(h);
  switch (a.design) {
    case 'pal': { const h1 = -a.L / 2, h2 = a.L / 2; return a.Pd + a.add * Math.min(1, Math.max(0, (h - h1) / (h2 - h1))); }
    case 'dfcl': { const inT = r > a.r0 && Math.floor((r - a.r0) / a.w) % 2 === 0; return a.Pb + (inT ? a.Pa : 0); }
    case 'dims': case 'hal': {
      const pitch = a.design === 'hal' ? a.dl : a.pitch;
      const r1 = a.design === 'hal' ? a.r0 + a.rings * a.dl : a.r1;
      if (r > a.r0 && r < Math.min(r1, a.sd)) { const q = (r - a.r0) % pitch; if (a.design === 'hal' || q < a.dl) return a.Pb + a.Pa; }
      return a.Pb;
    }
    case 'grad': return a.Pc + (a.Pe - a.Pc) * Math.pow(r / a.sd, a.q);
  }
  return 0;
}

function hitSeg(o, d, s) {
  const rx = s.bx - s.ax, ry = s.by - s.ay;
  const den = d.x * ry - d.y * rx; if (Math.abs(den) < 1e-12) return null;
  const t = ((s.ax - o.x) * ry - (s.ay - o.y) * rx) / den;
  if (t <= EPS) return null;
  const u = rx !== 0 ? ((o.x + d.x * t - s.ax) / rx) : ((o.y + d.y * t - s.ay) / ry);
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, nx: s.nx, ny: s.ny };
}
function angIn(a, a0, a1) {
  const TAU = 2 * Math.PI; let x = ((a - a0) % TAU + TAU) % TAU, w = ((a1 - a0) % TAU + TAU) % TAU;
  if (w === 0) w = TAU;
  return x <= w + 1e-9;
}
function hitArc(o, d, s) {
  const ox = o.x - s.cx, oy = o.y - s.cy;
  const b = ox * d.x + oy * d.y, cq = ox * ox + oy * oy - s.r * s.r;
  const disc = b * b - cq; if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [-b - sq, -b + sq]) {
    if (t <= EPS) continue;
    const px = o.x + d.x * t, py = o.y + d.y * t;
    const a = Math.atan2(py - s.cy, px - s.cx);
    if (angIn(a, s.a0, s.a1)) return { t, nx: (px - s.cx) / s.r, ny: (py - s.cy) / s.r };
  }
  return null;
}

/** Snell's law refraction of direction d across a surface with normal (nx,ny), n1→n2. */
export function refract(d, nx, ny, n1, n2) {
  let ci = -(d.x * nx + d.y * ny);
  if (ci < 0) { nx = -nx; ny = -ny; ci = -ci;[n1, n2] = [n2, n1]; }
  const r = n1 / n2, s2 = r * r * (1 - ci * ci);
  if (s2 > 1) { return { x: d.x + 2 * ci * nx, y: d.y + 2 * ci * ny, tir: true }; }   // TIR
  const ct = Math.sqrt(1 - s2);
  return { x: r * d.x + (r * ci - ct) * nx, y: r * d.y + (r * ci - ct) * ny, n2 };
}
function norm(v) { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; }

/**
 * Trace every visible source's rays through every visible component's
 * surfaces (non-sequential), returning memoized { segs, hits }.
 * segs: drawn ray segments {x1,y1,x2,y2,col,pw}
 * hits: absorbed rays {x,y,col,pw}
 */
export function traceAll() {
  if (_cache) return _cache;
  const surfs = []; _comps.forEach(c => { if (c.visible) surfs.push(...surfacesOf(c)); });
  const segs = [], hits = [], queue = [];
  for (const c of _comps) {
    if (!c.visible) continue; const d = PHYS[c.type]; if (!d?.src) continue;
    const th = c.angle * Math.PI / 180, dir = { x: Math.cos(th), y: Math.sin(th) }, pp = { x: -dir.y, y: dir.x };
    const N = Math.max(1, Math.round(c.p.N)), col = c.p.color || '#ff5252';
    for (let i = 0; i < N; i++) {
      const s = N === 1 ? 0 : (i / (N - 1)) * 2 - 1;
      if (d.src === 'collimated') {
        const o = { x: c.x + pp.x * s * c.p.w + dir.x * d.off, y: c.y + pp.y * s * c.p.w + dir.y * d.off };
        queue.push({ o, d: dir, pw: 1, col, dep: 0 });
      } else {
        const a = th + s * c.p.div * Math.PI / 180, dd = { x: Math.cos(a), y: Math.sin(a) };
        queue.push({ o: { x: c.x + dd.x * d.off, y: c.y + dd.y * d.off }, d: dd, pw: 1, col, dep: 0 });
      }
    }
  }
  let ev = 0;
  while (queue.length && ev++ < 4000) {
    const r = queue.pop();
    if (r.dep > 50 || r.pw < 0.02) continue;
    let best = null;
    for (const s of surfs) {
      const h = s.kind === 'seg' ? hitSeg(r.o, r.d, s) : hitArc(r.o, r.d, s);
      if (h && (!best || h.t < best.t)) { best = h; best.s = s; }
    }
    if (!best) { segs.push({ x1: r.o.x, y1: r.o.y, x2: r.o.x + r.d.x * DMAX, y2: r.o.y + r.d.y * DMAX, col: r.col, pw: r.pw }); continue; }
    const P = { x: r.o.x + r.d.x * best.t, y: r.o.y + r.d.y * best.t };
    segs.push({ x1: r.o.x, y1: r.o.y, x2: P.x, y2: P.y, col: r.col, pw: r.pw });
    const a = best.s.act, push = (dd, pw) => { dd = norm(dd); queue.push({ o: { x: P.x + dd.x * 0.05, y: P.y + dd.y * 0.05 }, d: dd, pw, col: r.col, dep: r.dep + 1 }); };
    switch (a.t) {
      case 'lens': {
        const den = r.d.x * a.ax + r.d.y * a.ay;
        if (Math.abs(den) < 1e-6) { push(r.d, r.pw); break; }
        const s = Math.sign(den), tq = s * a.f / den;
        const Q = { x: a.cx + r.d.x * tq, y: a.cy + r.d.y * tq };
        let nd = { x: Q.x - P.x, y: Q.y - P.y };
        if (nd.x * r.d.x + nd.y * r.d.y < 0) { nd.x *= -1; nd.y *= -1; }     // virtual focus (f<0)
        if (Math.hypot(nd.x, nd.y) < 1e-9) nd = r.d;
        push(nd, r.pw); break;
      }
      case 'mirror': {
        const k = 2 * (r.d.x * best.nx + r.d.y * best.ny);
        push({ x: r.d.x - k * best.nx, y: r.d.y - k * best.ny }, r.pw); break;
      }
      case 'bs': {
        push(r.d, r.pw * (1 - a.R));
        const k = 2 * (r.d.x * best.nx + r.d.y * best.ny);
        push({ x: r.d.x - k * best.nx, y: r.d.y - k * best.ny }, r.pw * a.R); break;
      }
      case 'refract': {
        const o = refract(r.d, best.nx, best.ny, 1, a.n); push({ x: o.x, y: o.y }, r.pw); break;
      }
      case 'grating': {
        let fx = best.nx, fy = best.ny;
        if (r.d.x * fx + r.d.y * fy < 0) { fx = -fx; fy = -fy; }
        const tx = -fy, ty = fx, si = r.d.x * tx + r.d.y * ty;
        for (const [m, eff] of [[0, 0.25], [1, 0.5], [-1, 0.25]]) {
          const sm = si + m * a.g;
          if (Math.abs(sm) <= 1) push({ x: tx * sm + fx * Math.sqrt(1 - sm * sm), y: ty * sm + fy * Math.sqrt(1 - sm * sm) }, r.pw * eff);
        } break;
      }
      case 'atten': push(r.d, r.pw * a.T); break;
      case 'zone': {
        const h = (P.x - a.cx) * a.ux + (P.y - a.cy) * a.uy;
        const da = r.d.x * a.ax + r.d.y * a.ay, dp = r.d.x * a.ux + r.d.y * a.uy;
        const dp2 = dp - zoneDefl(a, h);
        push({ x: a.ax * da + a.ux * dp2, y: a.ay * da + a.uy * dp2 }, r.pw); break;
      }
      case 'absorb': hits.push({ x: P.x, y: P.y, col: r.col, pw: r.pw }); break;
      case 'block': break;
    }
  }
  _cache = { segs, hits };
  return _cache;
}
