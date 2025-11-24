export interface Vector2 {
  x: number;
  y: number;
}

export enum CelestialType {
  STAR = 'STAR',
  PLANET = 'PLANET',
  COMET = 'COMET',
  GAS_CLOUD = 'GAS_CLOUD'
}

export interface CelestialObject {
  id: string;
  type: CelestialType;
  pos: Vector2; // Position relative to Black Hole center (0,0)
  vel: Vector2;
  mass: number;
  radius: number;
  color: string;
  trail: Vector2[];
}

export interface SimulationConfig {
  blackHoleMass: number; // In arbitrary solar mass units
  timeScale: number;
  gridDensity: number;
  showGrid: boolean;
  showLensing: boolean;
  renderMode: 'full' | 'wireframe' | 'simple';
  isPaused: boolean;
}

export interface ViewportState {
  offset: Vector2; // Camera panning
  zoom: number;    // Camera zoom
  rotation: number; // Pseudo-3D rotation angle (rad)
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
