/**
 * Approximate wavelength (nm) → display color, pure math (no DOM).
 * 400-700nm uses the classic visible-spectrum piecewise approximation;
 * 700-1200nm (near-IR, not actually visible) is mapped onto a stylized
 * fading red→maroon gradient so IR sources/rays stay visually distinct
 * from the true visible-red end of the spectrum on screen.
 */
export function wavelengthToColor(nm) {
  const w = Math.max(400, Math.min(1200, nm));
  let r, g, b;
  if (w <= 700) {
    if (w < 440) { r = -(w - 440) / (440 - 400); g = 0; b = 1; }
    else if (w < 490) { r = 0; g = (w - 440) / (490 - 440); b = 1; }
    else if (w < 510) { r = 0; g = 1; b = -(w - 510) / (510 - 490); }
    else if (w < 580) { r = (w - 510) / (580 - 510); g = 1; b = 0; }
    else if (w < 645) { r = 1; g = -(w - 645) / (645 - 580); b = 0; }
    else { r = 1; g = 0; b = 0; }
  } else {
    const t = (w - 700) / (1200 - 700);
    r = 0.85 - 0.55 * t; g = 0.04; b = 0.08 + 0.22 * t;
  }
  const hex = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
