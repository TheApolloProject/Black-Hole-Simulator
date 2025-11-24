import React, { useState } from 'react';
import BlackHoleCanvas from './components/BlackHoleCanvas';
import ControlPanel from './components/ControlPanel';
import AIChat from './components/AIChat';
import { SimulationConfig, CelestialObject, ViewportState, CelestialType } from './types';
import { INITIAL_OBJECTS, PLANET_PRESETS, PlanetPresetKey, G } from './constants';
import { MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [config, setConfig] = useState<SimulationConfig>({
    blackHoleMass: 10,
    timeScale: 1.0,
    gridDensity: 60,
    showGrid: true,
    showLensing: true,
    renderMode: 'full',
    isPaused: false
  });

  const [objects, setObjects] = useState<CelestialObject[]>([...INITIAL_OBJECTS]);
  
  const [viewport, setViewport] = useState<ViewportState>({
    offset: { x: 0, y: 0 },
    zoom: 1.0,
    rotation: 0
  });

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Handlers
  const handleReset = () => {
    setObjects([...INITIAL_OBJECTS]);
    setViewport({ offset: { x: 0, y: 0 }, zoom: 1.0, rotation: 0 });
    setConfig(prev => ({ ...prev, blackHoleMass: 10, timeScale: 1.0 }));
  };

  const handleAddObject = () => {
    const randomAngle = Math.random() * Math.PI * 2;
    const distance = 400 + Math.random() * 200;
    const speed = 15 + Math.random() * 10;
    
    // Position
    const px = Math.cos(randomAngle) * distance;
    const py = Math.sin(randomAngle) * distance;

    // Velocity (perpendicularish for orbit)
    const vx = -Math.sin(randomAngle) * speed;
    const vy = Math.cos(randomAngle) * speed;

    const newObj: CelestialObject = {
      id: `comet-${Date.now()}`,
      type: CelestialType.COMET,
      pos: { x: px, y: py },
      vel: { x: vx, y: vy },
      mass: 0.5,
      radius: 3,
      color: '#a5f3fc',
      trail: []
    };

    setObjects(prev => [...prev, newObj]);
  };

  const handleAddPlanet = (key: PlanetPresetKey) => {
    const preset = PLANET_PRESETS[key];
    const randomAngle = Math.random() * Math.PI * 2;
    const distance = 350 + Math.random() * 300; // Stable orbit range
    
    // Calculate Circular Orbit Velocity: v = sqrt(GM / r)
    // We want a stable circular orbit around the black hole.
    // v_mag = sqrt(G * BH_Mass / r)
    const vMag = Math.sqrt((G * config.blackHoleMass) / distance);
    
    // Tangent vector
    const vx = -Math.sin(randomAngle) * vMag;
    const vy = Math.cos(randomAngle) * vMag;

    const newPlanet: CelestialObject = {
      id: `planet-${Date.now()}`,
      type: CelestialType.PLANET,
      pos: { x: Math.cos(randomAngle) * distance, y: Math.sin(randomAngle) * distance },
      vel: { x: vx, y: vy },
      mass: preset.mass,
      radius: preset.radius,
      color: preset.color,
      trail: []
    };

    setObjects(prev => [...prev, newPlanet]);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex relative">
      
      {/* Main Simulation Area */}
      <div className="flex-1 h-full relative">
        <BlackHoleCanvas 
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
        onReset={handleReset}
        onAddObject={handleAddObject}
        onAddPlanet={handleAddPlanet}
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