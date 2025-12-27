import React, { useState } from 'react';
import BlackHoleCanvas3D from './components/BlackHoleCanvas3D';
import ControlPanel from './components/ControlPanel';
import AIChat from './components/AIChat';
import { SimulationConfig, CelestialObject, ViewportState, CelestialType } from './types';
import { INITIAL_OBJECTS, PLANET_PRESETS, PlanetPresetKey, STAR_PRESETS, StarPresetKey, G, RS_FACTOR } from './constants';
import { MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [config, setConfig] = useState<SimulationConfig>({
    blackHoleMass: 10,
    timeScale: 1.0,
    gridDensity: 60,
    showGrid: true,
    showLensing: true,
    enableTimeDilation: true,
    galaxyRotationSpeed: 0.2, // Default gentle rotation
    renderMode: 'full',
    isPaused: false
  });

  const [objects, setObjects] = useState<CelestialObject[]>([...INITIAL_OBJECTS]);
  
  const [viewport, setViewport] = useState<ViewportState>({
    cameraPosition: { x: 0, y: 300, z: 800 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    zoom: 1.0
  });

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Handlers
  const handleReset = () => {
    setObjects([...INITIAL_OBJECTS]);
    setViewport({ cameraPosition: { x: 0, y: 300, z: 800 }, cameraTarget: { x: 0, y: 0, z: 0 }, zoom: 1.0 });
    setConfig(prev => ({ ...prev, blackHoleMass: 10, timeScale: 1.0, galaxyRotationSpeed: 0.2 }));
  };

  const handleAddObject = () => {
    const randomAngle = Math.random() * Math.PI * 2;
    const randomPhi = Math.random() * Math.PI; // For 3D spherical coordinates
    const distance = 400 + Math.random() * 200;
    const speed = 15 + Math.random() * 10;
    
    // Position in 3D using spherical coordinates
    const px = Math.sin(randomPhi) * Math.cos(randomAngle) * distance;
    const py = Math.sin(randomPhi) * Math.sin(randomAngle) * distance;
    const pz = Math.cos(randomPhi) * distance;

    // Velocity (perpendicular for orbit)
    const vx = -Math.sin(randomAngle) * speed;
    const vy = Math.cos(randomAngle) * speed;
    const vz = (Math.random() - 0.5) * speed * 0.3; // Small z-component

    const newObj: CelestialObject = {
      id: `comet-${Date.now()}`,
      type: CelestialType.COMET,
      pos: { x: px, y: py, z: pz },
      vel: { x: vx, y: vy, z: vz },
      mass: 0.5,
      radius: 3,
      color: '#a5f3fc',
      trail: []
    };

    setObjects(prev => [...prev, newObj]);
  };

  const handleLaunchSlingshot = () => {
    // Spawns an object on a hyperbolic trajectory designed to slingshot
    const startX = -900;
    const startY = 140; // Aim slightly off-center to miss event horizon
    const startZ = 50;
    
    // High velocity to ensure open orbit (hyperbolic)
    const vx = 22; 
    const vy = -1.5; // Slight downward drift to counteract attraction initially
    const vz = 0;

    const newObj: CelestialObject = {
      id: `slingshot-${Date.now()}`,
      type: CelestialType.COMET,
      pos: { x: startX, y: startY, z: startZ },
      vel: { x: vx, y: vy, z: vz },
      mass: 0.5,
      radius: 4,
      color: '#86efac', // Light Green to distinguish
      trail: []
    };

    setObjects(prev => [...prev, newObj]);
    // Center view if zoomed in too much
    if (viewport.zoom > 1.5) {
       setViewport(prev => ({ ...prev, zoom: 1.0, cameraPosition: { x: 0, y: 300, z: 800 }, cameraTarget: { x: 0, y: 0, z: 0 } }));
    }
  };

  const handleBoost = () => {
    // Apply a prograde burn (increase speed in direction of travel)
    // "Oberth Effect": Burn is most efficient at high speed (periapsis)
    setObjects(prev => prev.map(obj => {
      // Don't boost static things if any (or clouds)
      if (obj.type === CelestialType.GAS_CLOUD) return obj;

      const boostFactor = 1.2; // 20% speed increase
      return {
        ...obj,
        vel: {
          x: obj.vel.x * boostFactor,
          y: obj.vel.y * boostFactor
        }
      };
    }));
  };

  const handleAddPlanet = (key: PlanetPresetKey) => {
    const preset = PLANET_PRESETS[key];
    const randomAngle = Math.random() * Math.PI * 2;
    const randomPhi = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.3; // Near equatorial plane
    const distance = 350 + Math.random() * 300; // Stable orbit range
    
    // Calculate Circular Orbit Velocity: v = sqrt(GM / r)
    // We want a stable circular orbit around the black hole.
    // v_mag = sqrt(G * BH_Mass / r)
    const vMag = Math.sqrt((G * config.blackHoleMass) / distance);
    
    // Position in 3D
    const px = Math.sin(randomPhi) * Math.cos(randomAngle) * distance;
    const py = Math.sin(randomPhi) * Math.sin(randomAngle) * distance;
    const pz = Math.cos(randomPhi) * distance;

    // Tangent vector (perpendicular to radius)
    const vx = -Math.sin(randomAngle) * vMag;
    const vy = Math.cos(randomAngle) * vMag;
    const vz = 0;

    const newPlanet: CelestialObject = {
      id: `planet-${Date.now()}`,
      type: CelestialType.PLANET,
      pos: { x: px, y: py, z: pz },
      vel: { x: vx, y: vy, z: vz },
      mass: preset.mass,
      radius: preset.radius,
      color: preset.color,
      trail: []
    };

    setObjects(prev => [...prev, newPlanet]);
  };

  const handleAddStar = (key: StarPresetKey) => {
    const preset = STAR_PRESETS[key];
    const randomAngle = Math.random() * Math.PI * 2;
    const randomPhi = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.3; // Near equatorial plane
    // Stars generally further out to avoid crowding the inner visualization
    const distance = 500 + Math.random() * 400; 
    
    const vMag = Math.sqrt((G * config.blackHoleMass) / distance);
    
    // Position in 3D
    const px = Math.sin(randomPhi) * Math.cos(randomAngle) * distance;
    const py = Math.sin(randomPhi) * Math.sin(randomAngle) * distance;
    const pz = Math.cos(randomPhi) * distance;

    const vx = -Math.sin(randomAngle) * vMag;
    const vy = Math.cos(randomAngle) * vMag;
    const vz = 0;

    const newStar: CelestialObject = {
      id: `star-${Date.now()}`,
      type: CelestialType.STAR,
      pos: { x: px, y: py, z: pz },
      vel: { x: vx, y: vy, z: vz },
      mass: preset.mass,
      radius: preset.radius,
      color: preset.color,
      trail: []
    };

    setObjects(prev => [...prev, newStar]);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex relative">
      
      {/* Main Simulation Area */}
      <div className="flex-1 h-full relative">
        <BlackHoleCanvas3D 
            config={config} 
            objects={objects} 
            setObjects={setObjects}
            viewport={viewport}
            setViewport={setViewport}
        />
        
        {/* Chat Toggle (Floating Action Button) */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="absolute bottom-6 right-6 z-30 bg-cyan-600 hover:bg-cyan-500 text-white p-3 rounded-full shadow-lg shadow-cyan-900/50 transition transform hover:scale-105"
            title="Ask Cosmic AI"
          >
            <MessageSquare size={24} />
          </button>
        )}
      </div>

      {/* Sidebars */}
      <ControlPanel 
        config={config} 
        setConfig={setConfig} 
        viewport={viewport}
        setViewport={setViewport}
        onReset={handleReset}
        onAddObject={handleAddObject}
        onAddPlanet={handleAddPlanet}
        onAddStar={handleAddStar}
        onLaunchSlingshot={handleLaunchSlingshot}
        onBoost={handleBoost}
        isExpanded={isSidebarExpanded}
        toggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <AIChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        blackHoleMass={config.blackHoleMass}
      />

    </div>
  );
};

export default App;