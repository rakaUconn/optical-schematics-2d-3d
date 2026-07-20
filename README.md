# Optical Schematics Builder — 2D / 3D

A browser-based optics bench editor that **physically ray-traces** every schematic you build, in real time, and renders it in both a 2D top-down layout and a linked 3D bench view. It ships with a general-purpose optics component library (sources, lenses, mirrors, beamsplitters, gratings, prisms, apertures, a reduced-eye model) and a set of myopia-control spectacle/contact-lens designs (PAL, DIMS, HAL, dual-focus, radial-gradient) whose zoned phase profiles are traced ray-by-ray rather than approximated.

Live demo: `https://rakaUconn.github.io/optical-schematics-2d-3d/` (published by the CI workflow on every push to `main`).

## Features

- **Non-sequential, exact ray tracing** — rays are traced against every visible surface in the scene each frame (not a fixed sequential path), so beamsplitters, multiple sources, and stray/ghost rays all work automatically.
- **Linked 2D / 3D views** — the 2D editor is the source of truth (drag, rotate, snap-to-grid); the 3D view renders the same traced rays and component placements as a Three.js bench scene.
- **1 px = 1 mm** working units, with draggable components, rotation (`R`), delete (`Del`/`Backspace`), and grid snapping.
- **30+ component types** across sources, lenses, mirrors/scanners, beamsplitters/dispersers (including wavelength-selective hot/cold mirrors), apertures/filters/phase elements, detectors, and vision-science parts (reduced eye, model eye, trial lens, fixation target, pupil plane, screen).
- **Wavelength-aware sources** — every source has a 400–1200nm wavelength slider that drives its ray color and its interaction with wavelength-dependent components (hot/cold mirrors).
- **Myopia-control lens designer** — PAL, DIMS, HAL, dual-focus contact lens, and radial-gradient profiles, each with a live power-profile plot `P(h)` in the properties panel and physically traced lenslet/zone ray deflection.
- **Import/export** — export the current view as a standalone SVG (drops into PowerPoint/Illustrator) or as JSON (full scene round-trip); import a previously exported JSON schematic.
- **Zero build-time coupling to the DOM in the physics core** — `src/engine/` is pure math and can be tested, reused, or run in a worker without a browser.

## Physics model

### Scene representation

A scene is a flat list of components, each with a position `(x, y)` in mm, a rotation `angle` in degrees, a `type`, and a parameter object `p`. `src/engine/physics.js` (`PHYS`) declares, per type: whether it's a ray **source** (`collimated` or `fan` emission) and/or has trace-relevant **action** behavior (`lens`, `mirror`, `cmirror`, `bs`, `grating`, `prism`, `aperture`, `atten`, `absorb`, `eye`, `zone`), plus the default parameter values.

### Ray tracing algorithm (`src/engine/trace.js`)

For each visible source, `N` rays are seeded (collimated: parallel rays spread across a beam half-width `w`; fan: rays spread across a half-divergence angle `div`). Every visible component contributes one or more geometric surfaces — line segments or circular arcs in its own rotated local frame — to a flat surface list. The tracer repeatedly finds the nearest surface hit for each in-flight ray (a stack-based non-sequential trace, up to depth 50 or power < 2%) and applies the surface's action:

| Action                 | Behavior                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lens`                 | Ideal thin-lens transform: rays through the same lens converge to/diverge from a shared focal-plane point, faithfully handling negative (diverging) focal lengths as virtual foci.    |
| `mirror` / `cmirror`   | Specular reflection off a flat or arc (spherical, in 2D cross-section) surface.                                                                                                       |
| `bs`                   | Beamsplitter: ray splits into a transmitted branch (power × `1−R`) and a reflected branch (power × `R`).                                                                              |
| `prism` / `eye` cornea | Snell's law refraction (`refract()`), including total internal reflection when `sin θ > 1`.                                                                                           |
| `grating`              | Diffraction into orders `m = −1, 0, +1` via the grating equation `sin θₘ = sin θᵢ + mλ/Λ`, with configurable diffraction efficiency split.                                            |
| `aperture`             | Two blocking blades clip rays outside a configurable radius.                                                                                                                          |
| `atten`                | Uniform power transmission (filters, polarizers, waveplates).                                                                                                                         |
| `zone`                 | Myopia-control designs: a transverse ray deflection `dφ/dh` computed from the design's local power profile `P(h)` (see below), applied at the surface intersection.                   |
| `spectral`             | Wavelength-dependent mirror (hot/cold): reflects with peak reflectance `R` inside its passband and a small residual `rLow` outside it, evaluated per-ray from the source's `wl` (nm). |
| `absorb`               | Terminates the ray and records a detector hit (camera, photodiode, retina, screen, …).                                                                                                |
| `block`                | Terminates the ray with no hit (aperture blades, eye sclera).                                                                                                                         |

### Reduced-eye model

The `eye`/`modeleye` types use a single refracting cornea arc (index 1.336, configurable radius of curvature) followed by a retina arc offset axially by `dz` (negative = hyperopic, positive = myopic defocus), with the sclera blocking rays outside the pupil.

Toggling the **Backward** header button seeds an additional point source at the fovea (the on-axis retina point) of every visible eye/model-eye and traces it backward out through the cornea, by optical reversibility of Snell's law. An emmetropic eye (`dz=0`) sends these rays back out collimated — visually confirming that the retina sits at the eye's focal plane. A myopic eye (`dz>0`) sends them out converging to a finite point in front of the eye (its far point); a hyperopic eye (`dz<0`) sends them out diverging (a virtual far point behind the eye). This backward retina source has its own **Backward retina source wavelength (nm)** slider (400–1200nm, default 555nm) in the eye's properties panel, which sets both the wavelength carried by every backward-traced ray (so it interacts correctly with downstream dichroic/hot/cold mirrors) and their displayed color.

### Wavelength-selectable sources

Every light source (laser, SLD, LED, point source, fiber output) has a **Wavelength (nm)** slider from 400–1200nm in its properties panel, alongside its existing manual ray-color swatch. Dragging the wavelength slider re-syncs the ray color to an approximate physical color (visible 400–700nm spectrum; 700–1200nm near-IR is shown as a stylized fading red→maroon gradient, since it isn't actually visible). Every traced ray carries its source's wavelength through lenses, mirrors, beamsplitters, etc., so it can interact with wavelength-dependent components — the dichroic and hot/cold mirrors below.

### Dichroic and hot / cold mirrors

**Splitters & dispersers** includes three wavelength-selective plate mirrors, all using the same `spectral` action and 45° plate convention as the plain beamsplitter (place with the beam along local +x for a true 45° incidence):

- **Dichroic** — a general-purpose long-pass edge filter with a live **Cutoff wavelength (nm)** slider (400–1200nm, default 550nm): wavelengths at or below the cutoff reflect at the adjustable peak reflectance `R`; wavelengths above it transmit ideally (0% reflectance) by default. An **Out-of-band reflectance** slider (`rLow`, default 0, up to 0.2) dials in a realistic residual if wanted. Moving the cutoff slider moves the edge live, so the same input wavelength can be made to reflect or transmit.
- **Hot mirror** — reflects 700–1200nm (near-IR) at the adjustable peak reflectance `R` (default 0.96) and, by default, ideally transmits visible light (0% reflectance); its own `rLow` slider dials in a residual.
- **Cold mirror** — reflects 400–700nm (visible) at `R` and, by default, ideally transmits near-IR; its own `rLow` slider dials in a residual.

Reflect/transmit power split is computed per-ray from the ray's wavelength against the mirror's band, using the same energy-conserving transmitted/reflected split as the generic beamsplitter (`bs`) action.

### Myopia-control zoned designs (`zoneDefl` / `zonePower`)

Each design (`pal`, `dims`, `hal`, `dfcl`, `grad`) defines a local optical power `P(h)` (diopters) as a function of radial/vertical position `h` on the lens. The ray deflection applied at the surface is the profile's local slope contribution, `zoneDefl(a, h)`, in radians; `zonePower(a, h)` is the same profile in diopters, used only for the properties-panel plot, not the trace itself:

- **PAL** — smoothstep-blended distance power `Pd` and near addition `add` across a corridor length `L`.
- **DIMS / HAL** — a plano (or `Pb`-power) base curve studded with discrete defocusing lenslets/rings of add power `Pa`, each deflecting rays about its own local center.
- **Dual-focus contact lens** — alternating annular zones of base and treatment power.
- **Radial-gradient** — a continuous power profile interpolating from center power `Pc` to edge power `Pe` with exponent `q`.

## Validation

`tests/engine.test.js` checks the engine against closed-form analytic optics results (Vitest; run with `npm test`):

| Test                                   | Analytic expectation                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. thin lens 2f→2f imaging             | Point source at object distance `s=240mm` through `f=120mm` images at `s'=240mm` (thin-lens equation `1/s + 1/s' = 1/f`).                                                                                                       |
| 2. collimated → back focal point       | Collimated input rays converge exactly at `x=f` for `f=100mm`.                                                                                                                                                                  |
| 3. negative lens virtual focus         | A diverging lens (`f=−100mm`) produces an outgoing ray whose backward extension passes through the virtual focus at `x=−100`.                                                                                                   |
| 4. concave mirror `f≈R/2`              | A spherical mirror (`R=200mm`) focuses a collimated off-axis ray near `x=−100` (paraxial focal length `R/2`), within a spherical-aberration tolerance.                                                                          |
| 5a. beamsplitter energy conservation   | Transmitted + reflected power sums to 1 (`R+T=1`) for `R=0.3`.                                                                                                                                                                  |
| 5b. beamsplitter reflection geometry   | The reflected branch of a `+x`-incident ray on a 45°-oriented beamsplitter turns 90°.                                                                                                                                           |
| 6. Snell's law                         | 45° incidence, `n=1.5`: refraction angle `= asin(sin 45°/1.5) = 28.13°`.                                                                                                                                                        |
| 7. total internal reflection           | 45° incidence from `n=1.5` into `n=1` (> critical angle 41.8°) is flagged `tir: true`.                                                                                                                                          |
| 8a/8b. reduced-eye focus               | An emmetropic eye (`dz=0`) focuses a beam tightly on the retina; an axial myopic offset (`dz=+8mm`) grows the retinal blur spot by >3×.                                                                                         |
| 8c/8d. backward propagation            | A point source seeded at the retina and traced backward through the cornea exits **collimated** for an emmetropic eye (`dz=0`); for a myopic eye (`dz=+8mm`) it exits **converging** to a finite far point in front of the eye. |
| 9. iris aperture clipping              | An 8mm iris clips all rays with `\|h\| > 8mm`; the remainder reach the screen.                                                                                                                                                  |
| 10. grating equation                   | A grating (`g=λ/Λ=0.4`) diffracts a normal-incidence ray into `sin θ = {−0.4, 0, +0.4}` for orders `m={−1,0,+1}`.                                                                                                               |
| 11. 4f relay                           | Two `f=100mm` lenses spaced 200mm apart re-collimate an off-axis beam with zero output slope and inverted (mirrored) height.                                                                                                    |
| 12. radial-gradient flat profile       | `Pc=Pe=5D` (no gradient) behaves like a uniform 5D lens, focusing at `f≈200mm`.                                                                                                                                                 |
| 13. DIMS clear zone                    | Rays inside the clear-zone radius `r0` pass through the plano base undeviated.                                                                                                                                                  |
| 14a/14b. DIMS lenslets                 | A ray through a lenslet's own center is undeviated; an off-center ray deflects by `(h−h_center)·Pa/1000`.                                                                                                                       |
| 15. DIMS + eye                         | With a DIMS lens in front of the reduced eye, lenslet rays cross the axis in front of the retina (myopic defocus) while clear-zone rays focus on it.                                                                            |
| 16. dual-focus CL treatment ring       | A ray in the treatment annulus deflects by `−h·(Pb+Pa)/1000`.                                                                                                                                                                   |
| 17a/17b. PAL zones                     | The distance zone (`Pd=0`) is undeviated; the near zone deflects by `−add·h/1000`.                                                                                                                                              |
| 18a. hot mirror spectral split         | At `wl=1000nm` (IR, in-band) the hot mirror reflects `R` and transmits `1−R`; at `wl=550nm` (visible, out-of-band) it's ideal by default (`rLow=0`) — 100% transmitted, 0% reflected.                                          |
| 18b. cold mirror spectral split        | At `wl=550nm` (visible, in-band) the cold mirror reflects `R` and transmits `1−R`; at `wl=1000nm` (IR, out-of-band) it's ideal by default (`rLow=0`) — 100% transmitted, 0% reflected.                                         |
| 18b2. adjustable out-of-band residual  | Setting `rLow` on a hot/cold mirror dials in a non-zero out-of-band reflectance for a more realistic (imperfect) coating.                                                                                                       |
| 18c. dichroic cutoff wavelength        | Below the cutoff `wl`, the dichroic reflects `R` and transmits `1−R`; above it, it's ideal by default (`rLow=0`) — fully transmitted. Moving the cutoff flips which side of a fixed input wavelength reflects.                  |
| 8e. backward retina wavelength routing | An eye's backward-traced retina rays, using the eye's own `wl` param, correctly reflect/transmit at a downstream hot mirror exactly as a same-wavelength forward source would (IR reflects at `R`, visible ideally transmits). |

## Getting started

```bash
npm install
npm run dev       # local dev server with hot reload
npm test          # run the Vitest validation suite once
npm run test:watch
npm run build      # production build → dist/
npm run preview    # preview the production build locally
```

## Project structure

```
src/
  engine/        pure ray-trace physics — no DOM, no globals
    physics.js     component type → params/action definitions (PHYS)
    trace.js       geometry helpers, zoned-design math, traceAll(), refract()
    defaults.js     default parameter values per component type
    index.js        public engine API
  ui/            DOM-facing editor: 2D SVG scene, properties panel, library
                 panel, header toolbar, and the app state store
  render3d/      Three.js bench view, built from the same traced rays
  main.js        wires state ↔ engine ↔ 2D/3D views together
  styles.css
tests/
  engine.test.js  Vitest suite, imports src/engine/ directly (see table above)
.github/workflows/
  deploy.yml      test → build → deploy dist/ to GitHub Pages on push to main
```

The `src/engine/` boundary is deliberate: it has no `document`/`window` references, so it can be imported directly in tests (as `tests/engine.test.js` does), run in a Web Worker, or reused outside the browser entirely.

## Deployment

Every push to `main` runs the Vitest suite, then (if it passes) builds the Vite production bundle and deploys `dist/` to GitHub Pages via `actions/upload-pages-artifact` + `actions/deploy-pages`. Pull requests only run the test job. To enable Pages for a fork, turn on **Settings → Pages → Source: GitHub Actions** once.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Citing this software

See [CITATION.cff](CITATION.cff), or use GitHub's "Cite this repository" button.
