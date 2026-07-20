/**
 * Properties panel — physics-aware form for the selected component,
 * including the live power-profile plot for zoned myopia-control designs.
 */
import { PHYS, zonePower, wavelengthToColor } from "../engine/index.js";
import {
  sel,
  byId,
  changed,
  retraceQuiet,
  cosmetic,
  removeComp,
  copyComp,
} from "./state.js";
import { esc } from "./util.js";

function drawProfile(container, c) {
  const el = container.querySelector("#profPlot");
  if (!el) return;
  const a = Object.assign({ design: PHYS[c.type].design }, c.p);
  const W = 214,
    Hh = 86,
    n = 240,
    sd = c.p.sd;
  let pmin = 1e9,
    pmax = -1e9;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const h = -sd + (2 * sd * i) / n,
      P = zonePower(a, h);
    pts.push([h, P]);
    pmin = Math.min(pmin, P);
    pmax = Math.max(pmax, P);
  }
  if (pmax - pmin < 0.5) {
    pmax += 0.25;
    pmin -= 0.25;
  }
  const pad = 0.12 * (pmax - pmin);
  pmin -= pad;
  pmax += pad;
  const X = (h) => ((h + sd) / (2 * sd)) * (W - 30) + 26,
    Y = (P) => Hh - 12 - ((P - pmin) / (pmax - pmin)) * (Hh - 22);
  let path = "";
  pts.forEach(([h, P], i) => {
    path += (i ? "L" : "M") + X(h).toFixed(1) + "," + Y(P).toFixed(1);
  });
  const zero =
    0 > pmin && 0 < pmax
      ? `<line x1="26" y1="${Y(0).toFixed(1)}" x2="${W - 4}" y2="${Y(0).toFixed(1)}" stroke="#2a3441" stroke-dasharray="3 3"/>`
      : "";
  el.innerHTML = `<svg width="${W}" height="${Hh}" style="background:#101419;border:1px solid #2a3441;border-radius:6px">
    <line x1="${X(0)}" y1="8" x2="${X(0)}" y2="${Hh - 12}" stroke="#2a3441"/>
    ${zero}
    <path d="${path}" fill="none" stroke="#5ad1e6" stroke-width="1.4"/>
    <text x="26" y="${Hh - 2}" fill="#8fa0b3" font-size="9" font-family="monospace">-${sd}</text>
    <text x="${W - 22}" y="${Hh - 2}" fill="#8fa0b3" font-size="9" font-family="monospace">+${sd} mm</text>
    <text x="3" y="14" fill="#8fa0b3" font-size="9" font-family="monospace">${pmax.toFixed(1)}D</text>
    <text x="3" y="${Hh - 12}" fill="#8fa0b3" font-size="9" font-family="monospace">${pmin.toFixed(1)}D</text>
  </svg>`;
}

/** Attaches the properties panel to a container element and returns { render }. */
export function createPropsPanel(container) {
  function render() {
    const box = container;
    if (sel == null || !byId(sel)) {
      box.className = "empty-note";
      box.innerHTML = `Nothing selected.<br><br>Add a <b>source</b>, then keep clicking parts to chain them along the beam path. Rays are <b>physically traced</b>: lenses obey the ideal-lens transform, mirrors reflect, prisms refract by Snell's law (with TIR), beamsplitters split power, gratings diffract into orders, apertures clip rays, and the reduced eye focuses light onto its retina.<br><br>The <b>Myopia-control designs</b> section traces zoned phase elements (PAL, DIMS, HAL, dual-focus CL, radial-gradient) with a live power-profile plot here — the designer view. Put one in front of the eye and watch lenslet rays focus in front of the retina.<br><br><span class="kbd">R</span> rotate · <span class="kbd">Del</span> remove`;
      return;
    }
    const c = byId(sel),
      d = PHYS[c.type];
    box.className = "";
    let html = `
      <div class="field"><label>Label</label><input type="text" id="pLabel" value="${esc(c.label)}"></div>
      <div class="row2">
        <div class="field"><label>x (mm)</label><input type="number" id="pX" value="${c.x}" step="12.5"></div>
        <div class="field"><label>y (mm)</label><input type="number" id="pY" value="${c.y}" step="12.5"></div>
      </div>
      <div class="field"><label>Angle: <b id="angV">${c.angle}°</b></label><input type="range" id="pAng" min="0" max="359" value="${((c.angle % 360) + 360) % 360}"></div>`;
    for (const [k, label, min, max, step] of d?.params || []) {
      html += `<div class="field"><label>${label}: <b id="v_${k}">${c.p[k]}</b></label><input type="range" data-k="${k}" class="phys" min="${min}" max="${max}" step="${step}" value="${c.p[k]}"></div>`;
    }
    if (d?.src)
      html += `<div class="field"><label>Ray color</label><input type="color" id="pColor" value="${c.p.color}"></div>`;
    if (d?.act === "zone")
      html += `<div class="field"><label>Power profile P(h) — the design</label><div id="profPlot"></div></div>`;
    html += `<label class="chk"><input type="checkbox" id="pVis" ${c.visible ? "checked" : ""}> Component visible</label>
      <div class="empty-note" style="margin-top:6px">id ${c.id}. New parts attach to this component while selected.</div>
      <button id="pCopy">Copy component</button>
      <button class="danger" id="pDel">Delete component</button>`;
    box.innerHTML = html;
    if (d?.act === "zone") drawProfile(box, c);

    box.querySelector("#pLabel").oninput = (e) => {
      c.label = e.target.value;
      cosmetic();
    };
    box.querySelector("#pX").onchange = (e) => {
      c.x = +e.target.value;
      changed();
    };
    box.querySelector("#pY").onchange = (e) => {
      c.y = +e.target.value;
      changed();
    };
    box.querySelector("#pAng").oninput = (e) => {
      c.angle = +e.target.value;
      box.querySelector("#angV").textContent = c.angle + "°";
      retraceQuiet();
    };
    box.querySelectorAll(".phys").forEach((inp) => {
      inp.oninput = (e) => {
        const k = e.target.dataset.k;
        c.p[k] = +e.target.value;
        box.querySelector("#v_" + k).textContent = c.p[k];
        if (k === "wl" && PHYS[c.type]?.src) {
          c.p.color = wavelengthToColor(c.p.wl);
          const pc = box.querySelector("#pColor");
          if (pc) pc.value = c.p.color;
        }
        retraceQuiet();
        if (PHYS[c.type]?.act === "zone") drawProfile(box, c);
      };
    });
    const pc = box.querySelector("#pColor");
    if (pc)
      pc.oninput = (e) => {
        c.p.color = e.target.value;
        retraceQuiet();
      };
    box.querySelector("#pVis").onchange = (e) => {
      c.visible = e.target.checked;
      changed();
    };
    box.querySelector("#pCopy").onclick = () => copyComp(c.id);
    box.querySelector("#pDel").onclick = () => removeComp(c.id);
  }
  return { render };
}
