/** Left sidebar: catalog of draggable/clickable component types. */
import { LIB } from './catalog.js';
import { GLYPH } from './glyphs.js';
import { addComp } from './state.js';

/** Renders the static library grid into `container` and wires click-to-add. */
export function createLibraryPanel(container) {
  let html = '';
  for (const g of LIB) {
    html += `<h3>${g.cat}</h3><div class="lib-grid">`;
    for (const [t, n] of g.items)
      html += `<button class="lib-item" data-type="${t}"><svg viewBox="-48 -40 96 80"><g class="comp">${GLYPH[t]}</g></svg><span>${n}</span></button>`;
    html += `</div>`;
  }
  container.innerHTML = html;
  container.addEventListener('click', e => {
    const b = e.target.closest('.lib-item');
    if (b) addComp(b.dataset.type);
  });
}
