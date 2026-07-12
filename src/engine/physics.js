/**
 * PHYSICS DEFINITIONS — pure data, no DOM dependencies.
 *
 * Each entry describes one component type:
 *   src    'collimated' | 'fan'   — ray-emitting sources
 *   act    the surface/interaction behaviour used by the trace engine
 *          (lens | mirror | cmirror | bs | grating | prism | aperture |
 *           atten | absorb | eye | zone)
 *   params [key, label, min, max, step, default] — physical parameter,
 *          also used by the UI to build slider controls
 *   off    source emission offset along local +x (mm)
 *   color  default ray color for sources
 *   face   [x, halfHeight] local absorbing face for 'absorb' actions
 *   design which zoned myopia-control profile ('pal' | 'dims' | 'hal' |
 *          'dfcl' | 'grad') a 'zone' action uses
 */
export const PHYS = {
  laser: { src: 'collimated', off: 38, color: '#ff3b30', params: [['N', 'Rays', 1, 15, 1, 5], ['w', 'Beam half-width (mm)', 1, 40, 1, 6]] },
  sld: { src: 'collimated', off: 33, color: '#ff8a5c', params: [['N', 'Rays', 1, 15, 1, 5], ['w', 'Beam half-width (mm)', 1, 40, 1, 6]] },
  led: { src: 'fan', off: 13, color: '#ffd54f', params: [['N', 'Rays', 1, 21, 1, 9], ['div', 'Half divergence (°)', 1, 80, 1, 24]] },
  pointsrc: { src: 'fan', off: 1, color: '#ffe08a', params: [['N', 'Rays', 1, 21, 1, 11], ['div', 'Half divergence (°)', 1, 89, 1, 40]] },
  fiber: { src: 'fan', off: 10, color: '#ff5252', params: [['N', 'Rays', 1, 21, 1, 7], ['div', 'Half divergence (°)', 1, 45, 1, 12]] },
  lens: { act: 'lens', params: [['f', 'Focal length (mm)', -500, 500, 5, 120], ['sd', 'Semi-diameter (mm)', 5, 40, 1, 30]] },
  achromat: { act: 'lens', params: [['f', 'Focal length (mm)', -500, 500, 5, 100], ['sd', 'Semi-diameter (mm)', 5, 40, 1, 30]] },
  cyl: { act: 'lens', params: [['f', 'Focal length in plane (mm)', -500, 500, 5, 150], ['sd', 'Semi-diameter (mm)', 5, 40, 1, 28]] },
  objective: { act: 'lens', params: [['f', 'Focal length (mm)', 2, 100, 1, 18], ['sd', 'Semi-diameter (mm)', 2, 20, 1, 10]] },
  badal: { act: 'lens', params: [['f', 'Focal length (mm)', 25, 500, 5, 150], ['sd', 'Semi-diameter (mm)', 5, 40, 1, 30]] },
  triallens: { act: 'lens', params: [['f', 'Focal length (mm)', -2000, 2000, 10, 250], ['sd', 'Semi-diameter (mm)', 5, 25, 1, 21]] },
  mirror: { act: 'mirror', params: [['sd', 'Semi-diameter (mm)', 5, 40, 1, 30]] },
  galvo: { act: 'mirror', params: [['sd', 'Semi-diameter (mm)', 3, 30, 1, 21]] },
  dm: { act: 'mirror', params: [['sd', 'Semi-diameter (mm)', 5, 40, 1, 28]] },
  slm: { act: 'mirror', params: [['sd', 'Semi-diameter (mm)', 5, 40, 1, 26]] },
  curvedmirror: { act: 'cmirror', params: [['R', 'Radius of curvature (mm)', 40, 2000, 10, 200], ['sd', 'Semi-diameter (mm)', 5, 40, 1, 26]] },
  bscube: { act: 'bs', params: [['R', 'Reflectance', 0, 1, 0.05, 0.5]] },
  bsplate: { act: 'bs', params: [['R', 'Reflectance', 0, 1, 0.05, 0.5]] },
  dichroic: { act: 'bs', params: [['R', 'Reflectance', 0, 1, 0.05, 0.5]] },
  pellicle: { act: 'bs', params: [['R', 'Reflectance', 0, 1, 0.05, 0.45]] },
  grating: { act: 'grating', params: [['g', 'λ/Λ (dispersion)', 0, 0.9, 0.01, 0.35], ['sd', 'Semi-height (mm)', 5, 40, 1, 28]] },
  prism: { act: 'prism', params: [['n', 'Refractive index', 1.2, 2.2, 0.01, 1.52]] },
  pinhole: { act: 'aperture', params: [['a', 'Aperture radius (mm)', 0.5, 25, 0.5, 2], ['sd', 'Blade semi-height (mm)', 10, 45, 1, 30]] },
  iris: { act: 'aperture', params: [['a', 'Aperture radius (mm)', 0.5, 28, 0.5, 10], ['sd', 'Blade semi-height (mm)', 10, 45, 1, 30]] },
  filter: { act: 'atten', params: [['T', 'Transmission', 0.05, 1, 0.05, 0.7]] },
  polarizer: { act: 'atten', params: [['T', 'Transmission', 0.05, 1, 0.05, 0.5]] },
  waveplate: { act: 'atten', params: [['T', 'Transmission', 0.05, 1, 0.05, 1]] },
  camera: { act: 'absorb', face: [-18, 9] },
  photodiode: { act: 'absorb', face: [-8, 7] },
  spectrometer: { act: 'absorb', face: [-14, 6] },
  shwfs: { act: 'absorb', face: [-8, 25] },
  fixation: { act: 'absorb', face: [0, 20] },
  screen: { act: 'absorb', face: [0, 30] },
  eye: { act: 'eye', params: [['rc', 'Cornea radius (mm)', 8, 20, 0.1, 13.1], ['dz', 'Axial offset, +myopic (mm)', -15, 15, 0.5, 0], ['pu', 'Pupil semi-aperture (mm)', 1, 12, 0.5, 8]] },
  modeleye: { act: 'eye', params: [['rc', 'Cornea radius (mm)', 8, 20, 0.1, 13.1], ['dz', 'Axial offset, +myopic (mm)', -15, 15, 0.5, 0], ['pu', 'Pupil semi-aperture (mm)', 1, 12, 0.5, 8]] },
  pupilplane: { act: null, params: [] },
  pal: { act: 'zone', design: 'pal', params: [['Pd', 'Distance power (D)', -15, 10, 0.25, -3], ['add', 'Add power (D)', 0, 4, 0.25, 2], ['L', 'Corridor length (mm)', 6, 30, 1, 14], ['sd', 'Semi-diameter (mm)', 10, 30, 1, 22]] },
  dims: { act: 'zone', design: 'dims', params: [['Pb', 'Base power (D)', -15, 5, 0.25, -3], ['Pa', 'Lenslet add (D)', 0, 8, 0.25, 3.5], ['r0', 'Clear zone radius (mm)', 2, 10, 0.1, 4.7], ['dl', 'Lenslet diameter (mm)', 0.4, 3, 0.01, 1.03], ['pitch', 'Lenslet pitch (mm)', 0.5, 4, 0.01, 1.45], ['r1', 'Treatment radius (mm)', 8, 25, 0.5, 16.5], ['sd', 'Semi-diameter (mm)', 10, 30, 1, 22]] },
  hal: { act: 'zone', design: 'hal', params: [['Pb', 'Base power (D)', -15, 5, 0.25, -3], ['Pa', 'Lenslet add (D)', 0, 10, 0.25, 4], ['r0', 'Clear zone radius (mm)', 2, 10, 0.1, 4.5], ['dl', 'Ring width (mm)', 0.4, 3, 0.01, 1.12], ['rings', 'Rings', 1, 15, 1, 11], ['sd', 'Semi-diameter (mm)', 10, 30, 1, 22]] },
  dfcl: { act: 'zone', design: 'dfcl', params: [['Pb', 'Base power (D)', -15, 5, 0.25, -3], ['Pa', 'Treatment add (D)', 0, 5, 0.25, 2], ['r0', 'Center zone radius (mm)', 0.5, 4, 0.05, 1.65], ['w', 'Ring width (mm)', 0.3, 3, 0.05, 1.4], ['sd', 'Semi-diameter (mm)', 3, 8, 0.5, 6]] },
  gradlens: { act: 'zone', design: 'grad', params: [['Pc', 'Center power (D)', -15, 15, 0.25, -3], ['Pe', 'Edge power (D)', -15, 15, 0.25, 1], ['q', 'Profile exponent', 1, 4, 1, 2], ['sd', 'Semi-diameter (mm)', 10, 30, 1, 22]] }
};
