/** Library panel catalog: category → [type, display name] pairs. */
export const LIB = [
  {
    cat: "Sources",
    items: [
      ["laser", "Laser"],
      ["sld", "SLD"],
      ["led", "LED"],
      ["pointsrc", "Point source"],
      ["fiber", "Fiber output"],
    ],
  },
  {
    cat: "Lenses",
    items: [
      ["lens", "Lens"],
      ["achromat", "Achromat"],
      ["cyl", "Cyl. lens"],
      ["objective", "Objective"],
      ["badal", "Badal lens"],
      ["dlens", "Deformable lens (transmission)"],
    ],
  },
  {
    cat: "Mirrors & scanners",
    items: [
      ["mirror", "Mirror"],
      ["curvedmirror", "Curved mirror"],
      ["galvo", "Galvo scanner"],
      ["dm", "Deformable mirror"],
    ],
  },
  {
    cat: "Splitters & dispersers",
    items: [
      ["bscube", "BS cube"],
      ["bsplate", "Plate BS"],
      ["dichroic", "Dichroic"],
      ["pellicle", "Pellicle"],
      ["hotmirror", "Hot mirror (45°, 700–1200nm)"],
      ["coldmirror", "Cold mirror (45°, 400–700nm)"],
      ["grating", "Grating"],
      ["prism", "Prism"],
    ],
  },
  {
    cat: "Apertures, filters, phase",
    items: [
      ["pinhole", "Pinhole"],
      ["iris", "Iris"],
      ["filter", "Filter"],
      ["polarizer", "Polarizer"],
      ["waveplate", "Waveplate"],
      ["slm", "SLM (reflective)"],
    ],
  },
  {
    cat: "Detectors",
    items: [
      ["camera", "Camera"],
      ["photodiode", "Photodiode"],
      ["spectrometer", "Spectrometer"],
      ["shwfs", "SH wavefront sensor"],
    ],
  },
  {
    cat: "Vision science",
    items: [
      ["eye", "Human eye (reduced)"],
      ["modeleye", "Model eye"],
      ["triallens", "Trial lens"],
      ["fixation", "Fixation target"],
      ["pupilplane", "Pupil plane"],
      ["screen", "Screen / target"],
    ],
  },
  {
    cat: "Myopia-control designs",
    items: [
      ["pal", "PAL (progressive)"],
      ["dims", "DIMS spectacle"],
      ["hal", "HAL spectacle"],
      ["dfcl", "Dual-focus contact"],
      ["gradlens", "Radial-gradient lens"],
    ],
  },
];

/** type → display name, derived from LIB. */
export const NAME = {};
LIB.forEach((g) =>
  g.items.forEach(([t, n]) => {
    NAME[t] = n;
  }),
);
