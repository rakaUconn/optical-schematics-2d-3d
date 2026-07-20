/**
 * 3D VIEW — renders the same physically traced rays as the 2D editor,
 * as a Three.js bench scene. Component meshes are simplified stand-ins
 * for the 2D glyphs (this is a schematic, not a CAD model).
 */
import * as THREE from "three";
import { traceAll } from "../engine/index.js";
import { state } from "../ui/state.js";

const H = 70;

const M = {
  glass: () =>
    new THREE.MeshPhongMaterial({
      color: 0x9fd0ff,
      transparent: true,
      opacity: 0.35,
      shininess: 120,
      specular: 0xffffff,
    }),
  metal: () => new THREE.MeshPhongMaterial({ color: 0x8b98a8, shininess: 60 }),
  dark: () => new THREE.MeshPhongMaterial({ color: 0x232b34, shininess: 30 }),
  post: () => new THREE.MeshPhongMaterial({ color: 0x1a2028, shininess: 20 }),
  white: () => new THREE.MeshPhongMaterial({ color: 0xf2f4f8, shininess: 40 }),
};

function mesh3(c) {
  const g = new THREE.Group();
  const add = (
    geo,
    mat,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  const t = c.type;
  if (
    [
      "lens",
      "achromat",
      "badal",
      "triallens",
      "cyl",
      "pal",
      "gradlens",
      "dims",
      "hal",
      "dfcl",
    ].includes(t)
  ) {
    const sd = c.p.sd || 30;
    add(
      new THREE.SphereGeometry(sd, 32, 20),
      M.glass(),
      0,
      0,
      0,
      0,
      0,
      0,
      0.28,
      1,
      1,
    );
    if (t === "achromat")
      add(
        new THREE.SphereGeometry(sd * 0.97, 32, 20),
        M.glass(),
        5,
        0,
        0,
        0,
        0,
        0,
        0.16,
        1,
        1,
      );
    if (t === "triallens")
      add(
        new THREE.TorusGeometry(sd, 3, 10, 40),
        M.metal(),
        0,
        0,
        0,
        0,
        Math.PI / 2,
        0,
      );
    if (t === "dims" || t === "hal") {
      const r1 = t === "hal" ? c.p.r0 + c.p.rings * c.p.dl : c.p.r1;
      const rm = (c.p.r0 + Math.min(r1, sd)) / 2;
      add(
        new THREE.TorusGeometry(rm, (Math.min(r1, sd) - c.p.r0) / 2, 12, 48),
        new THREE.MeshPhongMaterial({
          color: 0x5ad1e6,
          transparent: true,
          opacity: 0.28,
        }),
        0,
        0,
        0,
        0,
        Math.PI / 2,
        0,
        0.12,
        1,
        1,
      );
    }
    if (t === "dfcl")
      add(
        new THREE.TorusGeometry(c.p.r0 + c.p.w / 2, c.p.w / 2, 10, 40),
        new THREE.MeshPhongMaterial({
          color: 0x5ad1e6,
          transparent: true,
          opacity: 0.3,
        }),
        0,
        0,
        0,
        0,
        Math.PI / 2,
        0,
        0.15,
        1,
        1,
      );
  } else if (t === "objective") {
    add(
      new THREE.CylinderGeometry(10, 22, 44, 24),
      M.metal(),
      -8,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
    add(
      new THREE.SphereGeometry(9, 20, 14),
      M.glass(),
      15,
      0,
      0,
      0,
      0,
      0,
      0.4,
      1,
      1,
    );
  } else if (["mirror", "curvedmirror", "dm", "slm", "galvo"].includes(t)) {
    const sd = c.p.sd || 28;
    add(
      new THREE.CylinderGeometry(sd, sd, 4, 32),
      M.metal(),
      0,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
    add(
      new THREE.CylinderGeometry(sd, sd, 6, 32),
      M.dark(),
      5,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
    if (t === "galvo")
      add(new THREE.BoxGeometry(20, 26, 20), M.dark(), 0, -34, 0);
  } else if (t === "bscube") {
    add(new THREE.BoxGeometry(40, 40, 40), M.glass());
  } else if (
    [
      "bsplate",
      "dichroic",
      "pellicle",
      "filter",
      "polarizer",
      "waveplate",
      "hotmirror",
      "coldmirror",
    ].includes(t)
  ) {
    const tint = {
      dichroic: 0x7ee08a,
      hotmirror: 0xff5252,
      coldmirror: 0x5ad1e6,
    }[t];
    const mat = tint
      ? new THREE.MeshPhongMaterial({
          color: tint,
          transparent: true,
          opacity: 0.45,
        })
      : M.glass();
    add(
      new THREE.CylinderGeometry(24, 24, 3, 32),
      mat,
      0,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
  } else if (t === "grating") {
    add(new THREE.BoxGeometry(8, 50, 50), M.dark());
    add(
      new THREE.BoxGeometry(2, 44, 44),
      new THREE.MeshPhongMaterial({ color: 0x9fd0ff, emissive: 0x1c3a55 }),
      5,
      0,
      0,
    );
  } else if (t === "prism") {
    add(
      new THREE.CylinderGeometry(26, 26, 40, 3),
      M.glass(),
      0,
      0,
      0,
      Math.PI / 2,
      0,
      0,
    );
  } else if (["pinhole", "iris", "pupilplane"].includes(t)) {
    add(
      new THREE.CylinderGeometry(24, 24, 2.5, 32),
      M.dark(),
      0,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
    add(
      new THREE.TorusGeometry(Math.max(2, c.p.a || 5), 1.4, 8, 24),
      M.metal(),
      0,
      0,
      0,
      0,
      Math.PI / 2,
      0,
    );
  } else if (["camera", "spectrometer", "shwfs"].includes(t)) {
    add(new THREE.BoxGeometry(44, 36, 36), M.dark(), 12, 0, 0);
    add(
      new THREE.CylinderGeometry(11, 11, 16, 24),
      M.metal(),
      -16,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
  } else if (t === "photodiode") {
    add(new THREE.BoxGeometry(22, 22, 22), M.dark(), 6, 0, 0);
    add(
      new THREE.CylinderGeometry(7, 7, 3, 20),
      new THREE.MeshPhongMaterial({ color: 0x2b6d7a, emissive: 0x0b3a44 }),
      -6,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
  } else if (["laser", "sld"].includes(t)) {
    add(new THREE.BoxGeometry(80, 28, 28), M.dark(), -8, 0, 0);
    add(
      new THREE.CylinderGeometry(6, 6, 12, 20),
      M.metal(),
      36,
      0,
      0,
      0,
      0,
      Math.PI / 2,
    );
  } else if (["led", "pointsrc", "fiber"].includes(t)) {
    add(
      new THREE.SphereGeometry(6, 16, 12),
      new THREE.MeshPhongMaterial({ color: 0xffe08a, emissive: 0x8a6a1c }),
    );
    if (t === "fiber")
      add(
        new THREE.CylinderGeometry(4, 4, 20, 16),
        M.metal(),
        -12,
        0,
        0,
        0,
        0,
        Math.PI / 2,
      );
  } else if (t === "eye" || t === "modeleye") {
    add(new THREE.SphereGeometry(26, 28, 20), M.white());
    add(new THREE.SphereGeometry(10, 20, 14), M.glass(), -24, 0, 0);
    add(
      new THREE.SphereGeometry(8, 16, 12),
      new THREE.MeshPhongMaterial({ color: 0x5a7a9a }),
      -20,
      0,
      0,
    );
    if (t === "modeleye")
      add(new THREE.BoxGeometry(56, 10, 50), M.metal(), 0, -30, 0);
  } else if (t === "fixation" || t === "screen") {
    add(new THREE.BoxGeometry(3, 56, 56), M.white());
  } else {
    add(new THREE.BoxGeometry(20, 40, 40), M.dark());
  }
  return g;
}

/**
 * Attaches a Three.js bench view to `box` (a positioned DOM container).
 * Returns { build, resize, setAnimating } — build() rebuilds the scene
 * from the current app state + trace, resize() matches the canvas to the
 * container, setAnimating(bool) starts/stops the orbit render loop.
 */
export function createRender3D(box) {
  let renderer, scene, camera;
  let animOn = false;
  const orbit = { theta: -0.9, phi: 1.05, r: 1000, tx: 0, tz: 0 };

  function ensure() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    box.appendChild(renderer.domElement);
    camera = new THREE.PerspectiveCamera(45, 1, 1, 20000);
    let d3 = null;
    box.addEventListener("pointerdown", (e) => {
      d3 = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 };
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener("pointermove", (e) => {
      if (!d3) return;
      const dx = e.clientX - d3.x,
        dy = e.clientY - d3.y;
      d3.x = e.clientX;
      d3.y = e.clientY;
      if (d3.pan) {
        const s = orbit.r * 0.0015;
        orbit.tx +=
          (dx * Math.cos(orbit.theta) - dy * Math.sin(orbit.theta)) * s;
        orbit.tz -=
          (dx * Math.sin(orbit.theta) + dy * Math.cos(orbit.theta)) * s;
      } else {
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.min(1.52, Math.max(0.12, orbit.phi - dy * 0.005));
      }
    });
    box.addEventListener("pointerup", () => {
      d3 = null;
    });
    box.addEventListener("contextmenu", (e) => e.preventDefault());
    box.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        orbit.r = Math.min(
          7000,
          Math.max(150, orbit.r * Math.exp(e.deltaY * 0.0012)),
        );
      },
      { passive: false },
    );
  }

  function build() {
    ensure();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1014);
    scene.fog = new THREE.Fog(0x0c1014, 2500, 8000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(400, 900, 300);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.25);
    fill.position.set(-500, 400, -400);
    scene.add(fill);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3400, 24, 2400),
      new THREE.MeshPhongMaterial({ color: 0x151b22, shininess: 15 }),
    );
    table.position.y = -12;
    scene.add(table);
    const grid = new THREE.GridHelper(3400, 136, 0x26303c, 0x1c242e);
    grid.position.y = 0.5;
    scene.add(grid);
    for (const c of state.comps) {
      if (!c.visible) continue;
      const g = mesh3(c);
      g.position.set(c.x, H, c.y);
      g.rotation.y = (-c.angle * Math.PI) / 180;
      scene.add(g);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 4.5, H - 14, 14),
        M.post(),
      );
      post.position.set(c.x, (H - 14) / 2, c.y);
      scene.add(post);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 16, 5, 20),
        M.post(),
      );
      base.position.set(c.x, 2.5, c.y);
      scene.add(base);
    }
    // physically traced rays → line segments with power-weighted brightness
    const tr = traceAll();
    if (tr.segs.length) {
      const pos = new Float32Array(tr.segs.length * 6),
        col = new Float32Array(tr.segs.length * 6);
      const tmp = new THREE.Color();
      tr.segs.forEach((s, i) => {
        pos.set([s.x1, H, s.y1, s.x2, H, s.y2], i * 6);
        tmp.set(s.col).multiplyScalar(0.25 + 0.75 * Math.min(1, s.pw));
        col.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], i * 6);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      scene.add(
        new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
          }),
        ),
      );
    }
    for (const h of tr.hits) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 10, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(h.col) }),
      );
      m.position.set(h.x, H, h.y);
      scene.add(m);
    }
    if (state.comps.length) {
      let sx = 0,
        sz = 0;
      state.comps.forEach((c) => {
        sx += c.x;
        sz += c.y;
      });
      orbit.tx = sx / state.comps.length;
      orbit.tz = sz / state.comps.length;
    }
  }

  function resize() {
    if (!renderer || box.clientWidth === 0) return;
    renderer.setSize(box.clientWidth, box.clientHeight);
    camera.aspect = box.clientWidth / box.clientHeight;
    camera.updateProjectionMatrix();
  }

  function loop() {
    if (!animOn) return;
    requestAnimationFrame(loop);
    const { theta, phi, r, tx, tz } = orbit;
    camera.position.set(
      tx + r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      tz + r * Math.sin(phi) * Math.sin(theta),
    );
    camera.lookAt(tx, H, tz);
    renderer.render(scene, camera);
  }

  function setAnimating(on) {
    animOn = on;
    if (on) loop();
  }

  return { build, resize, setAnimating };
}
