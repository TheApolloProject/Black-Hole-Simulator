import React, { useState } from 'react';
import { Settings, Play, Pause, RefreshCw, PlusCircle, Grid3X3, Eye, Zap, Globe, Sun, Rocket, ChevronsUp } from 'lucide-react';
import { SimulationConfig } from '../types';
import { PLANET_PRESETS, PlanetPresetKey, STAR_PRESETS, StarPresetKey } from '../constants';

interface ControlPanelProps {
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  onReset: () => void;
  onAddObject: () => void; // Adds Comet
  onAddPlanet: (key: PlanetPresetKey) => void;
  onAddStar: (key: StarPresetKey) => void;
  onLaunchSlingshot: () => void;
  onBoost: () => void;
  isExpanded: boolean;
  toggleExpand: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  config, 
  setConfig, 
  onReset, 
  onAddObject,
  onAddPlanet,
  onAddStar,
  onLaunchSlingshot,
  onBoost,
  isExpanded,
  toggleExpand 
}) => {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetPresetKey>('EARTH');
  const [selectedStar, setSelectedStar] = useState<StarPresetKey>('SUN');
  
  const updateConfig = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div 
      className={`absolute top-0 right-0 h-full bg-gray-900/90 backdrop-blur-md border-l border-gray-700 transition-all duration-300 ease-in-out z-40 ${isExpanded ? 'w-80 translate-x-0' : 'w-0 translate-x-full'}`}
    >
       {/* Toggle Button (Visible when collapsed) */}
       {!isExpanded && (
        <button 
          onClick={toggleExpand}
          className="absolute top-4 -left-12 bg-gray-800 text-white p-2 rounded-l-md border-y border-l border-gray-700 hover:bg-gray-700 transition"
        >
          <Settings size={20} />
        </button>
      )}

      {isExpanded && (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-5 border-b border-gray-700 flex justify-between items-center">
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="text-cyan-400" size={20} />
                Simulation Controls
             </h2>
             <button onClick={toggleExpand} className="text-gray-400 hover:text-white">
                ✕
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Playback */}
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Playback</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => updateConfig('isPaused', !config.isPaused)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded font-medium transition ${config.isPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                >
                  {config.isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
                </button>
                <button 
                  onClick={onReset}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded transition"
                  title="Reset Simulation"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Maneuvers Section */}
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wider text-green-400 font-semibold flex items-center gap-2">
                <Rocket size={12}/> Maneuvers
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={onLaunchSlingshot}
                  className="bg-gray-800 hover:bg-gray-700 border border-green-700/50 text-green-100 p-2 rounded text-xs flex flex-col items-center gap-1 transition"
                >
                   <Rocket size={16} className="text-green-400" />
                   Launch Slingshot
                </button>
                <button 
                  onClick={onBoost}
                  className="bg-gray-800 hover:bg-gray-700 border border-amber-700/50 text-amber-100 p-2 rounded text-xs flex flex-col items-center gap-1 transition"
                >
                   <ChevronsUp size={16} className="text-amber-400" />
                   Gravity Assist
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                Launch a high-speed comet or boost existing objects.
              </p>
            </div>

            {/* Black Hole Properties */}
            <div className="space-y-4">
               <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Singularity</label>
               
               <div>
                 <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Mass</span>
                    <span className="text-cyan-400 font-mono">{config.blackHoleMass.toFixed(1)} M☉</span>
                 </div>
                 <input 
                    type="range" min="1" max="50" step="0.5"
                    value={config.blackHoleMass}
                    onChange={(e) => updateConfig('blackHoleMass', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                 />
               </div>
            </div>

            {/* Visuals */}
            <div className="space-y-4">
               <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Visuals & Lensing</label>
               
               <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 flex items-center gap-2"><Eye size={16}/> Show Lensing</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={config.showLensing} onChange={(e) => updateConfig('showLensing', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
               </div>

               <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300 flex items-center gap-2"><Grid3X3 size={16}/> Show Grid</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={config.showGrid} onChange={(e) => updateConfig('showGrid', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </label>
               </div>

               <div>
                 <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Time Scale</span>
                    <span className="text-cyan-400 font-mono">{config.timeScale.toFixed(1)}x</span>
                 </div>
                 <input 
                    type="range" min="0.1" max="5.0" step="0.1"
                    value={config.timeScale}
                    onChange={(e) => updateConfig('timeScale', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                 />
               </div>
            </div>

            {/* Objects */}
            <div className="space-y-3">
               <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Matter</label>
               
               {/* Comets */}
               <button 
                  onClick={onAddObject}
                  className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 rounded flex items-center justify-center gap-2 transition text-sm"
               >
                 <PlusCircle size={16} /> Add Random Comet
               </button>

               {/* Planets */}
               <div className="bg-gray-800/50 p-2 rounded border border-gray-700 space-y-2 mt-2">
                 <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Globe size={14} className="text-cyan-400"/>
                    <span>New Planet</span>
                 </div>
                 <div className="flex gap-2">
                    <select 
                      value={selectedPlanet} 
                      onChange={(e) => setSelectedPlanet(e.target.value as PlanetPresetKey)}
                      className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      {Object.entries(PLANET_PRESETS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => onAddPlanet(selectedPlanet)}
                      className="bg-cyan-700 hover:bg-cyan-600 text-white px-3 py-1 rounded transition"
                      title="Add Planet"
                    >
                      <PlusCircle size={18} />
                    </button>
                 </div>
               </div>

               {/* Stars */}
               <div className="bg-gray-800/50 p-2 rounded border border-gray-700 space-y-2 mt-2">
                 <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Sun size={14} className="text-yellow-400"/>
                    <span>New Star</span>
                 </div>
                 <div className="flex gap-2">
                    <select 
                      value={selectedStar} 
                      onChange={(e) => setSelectedStar(e.target.value as StarPresetKey)}
                      className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                    >
                      {Object.entries(STAR_PRESETS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => onAddStar(selectedStar)}
                      className="bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded transition"
                      title="Add Star"
                    >
                      <PlusCircle size={18} />
                    </button>
                 </div>
               </div>

            </div>
            
            <div className="pt-4 border-t border-gray-800">
               <p className="text-xs text-gray-500 leading-relaxed">
                  Tip: Use Maneuvers to test gravity assists. High velocity objects can escape the pull.
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;