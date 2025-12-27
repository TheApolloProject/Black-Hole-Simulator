export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
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
  pos: Vector3; // Position relative to Black Hole center (0,0,0)
  vel: Vector3;
  mass: number;
  radius: number;
  color: string;
  trail: Vector3[];
}

export interface SimulationConfig {
  blackHoleMass: number; // In arbitrary solar mass units
  timeScale: number;
  gridDensity: number;
  showGrid: boolean;
  showLensing: boolean;
  enableTimeDilation: boolean;
  galaxyRotationSpeed: number; // New: Controls speed of background galaxy rotation
  renderMode: 'full' | 'wireframe' | 'simple';
  isPaused: boolean;
}

export interface ViewportState {
  cameraPosition: Vector3; // 3D Camera position
  cameraTarget: Vector3;   // Where camera is looking
  zoom: number;            // Camera zoom (distance multiplier)
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}