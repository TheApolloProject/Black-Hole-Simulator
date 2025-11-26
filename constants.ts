import { CelestialType, CelestialObject } from './types';

export const G = 1000; // Gravitational constant for simulation scale
export const C = 200; // Speed of light for simulation scale (reduced for visible relativistic effects)
export const RS_FACTOR = 1.5; // Visual scaling for Schwarzschild radius (Rs = M * RS_FACTOR)

// UI Colors
export const COLORS = {
  primary: '#0ea5e9', // Sky blue
  accent: '#f59e0b',  // Amber
  background: '#000000',
  grid: 'rgba(6, 182, 212, 0.15)', // Cyan low opacity
  text: '#f3f4f6',
};

// Physics Limits
export const MAX_TRAIL_LENGTH = 100; // Longer trails for slingshot visualization
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

export const PLANET_PRESETS = {
  EARTH: { mass: 2, radius: 5, label: 'Earth', color: '#60a5fa' }, // Blue
  JUPITER: { mass: 8, radius: 11, label: 'Jupiter', color: '#d97706' }, // Orange/Brown
  MARS: { mass: 1, radius: 3.5, label: 'Mars', color: '#ef4444' }, // Red
  NEPTUNE: { mass: 4, radius: 8, label: 'Neptune', color: '#6366f1' } // Indigo
} as const;

export type PlanetPresetKey = keyof typeof PLANET_PRESETS;

export const STAR_PRESETS = {
  SUN: { mass: 10, radius: 12, label: 'Sun-like', color: '#fbbf24' }, // Yellow
  SIRIUS: { mass: 20, radius: 16, label: 'Sirius (White)', color: '#e0f2fe' }, // White/Blueish
  RIGEL: { mass: 40, radius: 25, label: 'Rigel (Blue Supergiant)', color: '#60a5fa' }, // Blue
  BETELGEUSE: { mass: 30, radius: 45, label: 'Betelgeuse (Red Giant)', color: '#ef4444' }, // Red
  UY_SCUTI: { mass: 60, radius: 70, label: 'UY Scuti (Hypergiant)', color: '#b91c1c' }, // Deep Red
  STEPHENSON: { mass: 70, radius: 80, label: 'Stephenson 2-18', color: '#7f1d1d' } // Dark Red
} as const;

export type StarPresetKey = keyof typeof STAR_PRESETS;

export const INITIAL_OBJECTS: CelestialObject[] = [
  {
    id: 'star-1',
    type: CelestialType.STAR,
    pos: { x: 300, y: 0 },
    vel: { x: 0, y: 15 }, // Circular orbit approx
    mass: 10,
    radius: 12,
    color: '#fbbf24', // Amber
    trail: []
  },
  {
    id: 'planet-1',
    type: CelestialType.PLANET,
    pos: { x: -400, y: 100 },
    vel: { x: 5, y: -12 },
    mass: 2,
    radius: 5,
    color: '#9ca3af', // Gray
    trail: []
  },
  {
    id: 'comet-1',
    type: CelestialType.COMET,
    pos: { x: -600, y: -600 },
    vel: { x: 25, y: 20 }, // Hyperbolic
    mass: 0.5,
    radius: 3,
    color: '#60a5fa', // Blue
    trail: []
  }
];