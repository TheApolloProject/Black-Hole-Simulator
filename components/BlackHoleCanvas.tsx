import React, { useRef, useEffect, useState, useCallback } from 'react';
import { G, RS_FACTOR, COLORS } from '../constants';
import { CelestialObject, SimulationConfig, Vector2, ViewportState, CelestialType } from '../types';

// Helper for lensing (shared between render and hit test)
const getLensedPosition = (p: Vector2, mass: number, showLensing: boolean): Vector2 => {
    if (!showLensing) return p;
    
    const rs = mass * RS_FACTOR;
    // Einstein Radius RE = sqrt(4GM)
    const re = Math.sqrt(4 * G * mass); 
    
    const rSq = p.x * p.x + p.y * p.y;
    const r = Math.sqrt(rSq);
    
    if (r < rs) return p; // Inside event horizon

    // Deflection angle ~ 4GM/c^2 * 1/b (Visual approx)
    const deflection = (re * re) / r; 
    
    const rNew = r + deflection;
    const scale = rNew / r;
    
    return { x: p.x * scale, y: p.y * scale };
};

interface BlackHoleCanvasProps {
  config: SimulationConfig;
  objects: CelestialObject[];
  setObjects: React.Dispatch<React.SetStateAction<CelestialObject[]>>;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
}

interface BackgroundStar {
  pos: Vector2;
  size: number;
  baseAlpha: number;
}

const BlackHoleCanvas: React.FC<BlackHoleCanvasProps> = ({ 
  config, objects, setObjects, viewport, setViewport 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef<Vector2>({ x: 0, y: 0 });
  const backgroundStars = useRef<BackgroundStar[]>([]);
  
  const [hoverInfo, setHoverInfo] = useState<{ id: string, x: number, y: number } | null>(null);

  // Initialize Background Stars
  useEffect(() => {
    if (backgroundStars.current.length > 0) return;
    
    const stars: BackgroundStar[] = [];
    const spread = 4000; // World units
    const count = 1200;

    for (let i = 0; i < count; i++) {
        stars.push({
            pos: {
                x: (Math.random() - 0.5) * 2 * spread,
                y: (Math.random() - 0.5) * 2 * spread
            },
            size: Math.random() * 1.5 + 0.5,
            baseAlpha: Math.random() * 0.7 + 0.1
        });
    }
    backgroundStars.current = stars;
  }, []);

  // Physics Update Loop
  const updatePhysics = useCallback(() => {
    if (config.isPaused) return;

    setObjects(prevObjects => {
      const dt = 0.016 * config.timeScale; 
      const rs = config.blackHoleMass * RS_FACTOR;
      
      return prevObjects.map(obj => {
        const distSq = obj.pos.x * obj.pos.x + obj.pos.y * obj.pos.y;
        const dist = Math.sqrt(distSq);

        if (dist < rs) {
          return { ...obj, type: CelestialType.GAS_CLOUD, radius: 0, mass: 0 }; 
        }

        const forceMag = (G * config.blackHoleMass) / distSq;
        
        const acc = {
          x: -forceMag * (obj.pos.x / dist),
          y: -forceMag * (obj.pos.y / dist)
        };

        const newVel = {
          x: obj.vel.x + acc.x * dt,
          y: obj.vel.y + acc.y * dt
        };

        const newPos = {
          x: obj.pos.x + newVel.x * dt,
          y: obj.pos.y + newVel.y * dt
        };

        const newTrail = [...obj.trail, obj.pos];
        if (newTrail.length > 200) newTrail.shift();

        return {
          ...obj,
          pos: newPos,
          vel: newVel,
          trail: newTrail
        };
      }).filter(o => o.mass > 0);
    });
  }, [config.isPaused, config.timeScale, config.blackHoleMass, setObjects]);

  // Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
            canvas.width = clientWidth;
            canvas.height = clientHeight;
        }
    }

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Clear Screen
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    const rs = config.blackHoleMass * RS_FACTOR; 
    
    const toScreen = (v: Vector2) => ({
      x: cx + (v.x + viewport.offset.x) * viewport.zoom,
      y: cy + (v.y + viewport.offset.y) * viewport.zoom
    });

    // --- DRAW BACKGROUND STARS ---
    backgroundStars.current.forEach(star => {
        const lensedPos = getLensedPosition(star.pos, config.blackHoleMass, config.showLensing);
        const screenPos = toScreen(lensedPos);

        // Optimization: Don't draw if off screen
        if (screenPos.x < -5 || screenPos.x > w + 5 || screenPos.y < -5 || screenPos.y > h + 5) return;

        ctx.fillStyle = `rgba(255, 255, 255, ${star.baseAlpha})`;
        ctx.beginPath();
        // Scale star slightly with zoom but clamp it so they don't get huge
        const r = Math.min(star.size * viewport.zoom * 0.8, 3);
        ctx.arc(screenPos.x, screenPos.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
    });

    // --- DRAW GRID ---
    if (config.showGrid) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      
      const gridSize = config.gridDensity;
      const rangeX = w / viewport.zoom / 2 + 100; 
      const rangeY = h / viewport.zoom / 2 + 100;
      
      const minX = -rangeX - viewport.offset.x;
      const maxX = rangeX - viewport.offset.x;
      const minY = -rangeY - viewport.offset.y;
      const maxY = rangeY - viewport.offset.y;

      const startX = Math.floor(minX / gridSize) * gridSize;
      const startY = Math.floor(minY / gridSize) * gridSize;

      ctx.beginPath();
      
      for (let x = startX; x <= maxX; x += gridSize) {
        let first = true;
        for (let y = minY; y <= maxY; y += 20) {
          const worldPos = { x, y };
          const lensedWorld = getLensedPosition(worldPos, config.blackHoleMass, config.showLensing);
          const screenPos = toScreen(lensedWorld);
          
          if (first) {
            ctx.moveTo(screenPos.x, screenPos.y);
            first = false;
          } else {
            ctx.lineTo(screenPos.x, screenPos.y);
          }
        }
      }

      for (let y = startY; y <= maxY; y += gridSize) {
        let first = true;
        for (let x = minX; x <= maxX; x += 20) {
          const worldPos = { x, y };
          const lensedWorld = getLensedPosition(worldPos, config.blackHoleMass, config.showLensing);
          const screenPos = toScreen(lensedWorld);
          
          if (first) {
            ctx.moveTo(screenPos.x, screenPos.y);
            first = false;
          } else {
            ctx.lineTo(screenPos.x, screenPos.y);
          }
        }
      }
      ctx.stroke();
    }

    // --- DRAW ACCRETION DISK ---
    const screenCenter = toScreen({x: 0, y: 0});
    const diskRad = rs * 6 * viewport.zoom;
    
    const gradient = ctx.createRadialGradient(
      screenCenter.x, screenCenter.y, rs * viewport.zoom,
      screenCenter.x, screenCenter.y, diskRad
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.15, 'rgba(255, 100, 0, 0.9)'); 
    gradient.addColorStop(0.3, 'rgba(255, 50, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, diskRad, 0, Math.PI * 2);
    ctx.fill();

    // --- DRAW OBJECTS ---
    objects.forEach(obj => {
        if (obj.trail.length > 1) {
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 1 + (obj.mass / 10);
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            obj.trail.forEach((pos, i) => {
                const lensedPos = getLensedPosition(pos, config.blackHoleMass, config.showLensing);
                const sp = toScreen(lensedPos);
                if (i === 0) ctx.moveTo(sp.x, sp.y);
                else ctx.lineTo(sp.x, sp.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        const lensedPos = getLensedPosition(obj.pos, config.blackHoleMass, config.showLensing);
        const screenPos = toScreen(lensedPos);
        
        ctx.fillStyle = obj.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = obj.color;
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, obj.radius * viewport.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // --- DRAW SHADOW ---
    const shadowRadius = rs * 2.6 * viewport.zoom;
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1 * viewport.zoom;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius + 1, 0, Math.PI * 2);
    ctx.stroke();

  }, [config, objects, viewport]);

  // Animation Loop
  useEffect(() => {
    const loop = (time: number) => {
      updatePhysics();
      render();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updatePhysics, render]);

  // Input Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        
        setViewport(prev => ({
            ...prev,
            offset: {
                x: prev.offset.x + dx / prev.zoom,
                y: prev.offset.y + dy / prev.zoom
            }
        }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };

    // Hover Detection
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const cx = w / 2;
    const cy = h / 2;
    
    let foundId: string | null = null;
    
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.type === CelestialType.GAS_CLOUD) continue;

        const lensedPos = getLensedPosition(obj.pos, config.blackHoleMass, config.showLensing);
        
        const sx = cx + (lensedPos.x + viewport.offset.x) * viewport.zoom;
        const sy = cy + (lensedPos.y + viewport.offset.y) * viewport.zoom;
        
        const dist = Math.hypot(mx - sx, my - sy);
        const radius = Math.max(obj.radius * viewport.zoom, 8); 
        
        if (dist <= radius + 5) {
             foundId = obj.id;
             break;
        }
    }
    
    if (foundId) {
        setHoverInfo({ id: foundId, x: mx, y: my });
    } else {
        setHoverInfo(null);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };
  
  const handleMouseLeave = () => {
    isDragging.current = false;
    setHoverInfo(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    setViewport(prev => {
        const newZoom = Math.max(0.1, Math.min(5.0, prev.zoom - e.deltaY * zoomSensitivity));
        return { ...prev, zoom: newZoom };
    });
  };

  // Get hovered object details for tooltip
  const hoveredObj = hoverInfo ? objects.find(o => o.id === hoverInfo.id) : null;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black cursor-move">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="block touch-none"
      />
      
      {/* Overlay Info */}
      <div className="absolute top-4 left-4 pointer-events-none select-none text-xs font-mono text-cyan-500/80 space-y-1 z-10">
        <div>Frame Time: 16.6ms (60 FPS)</div>
        <div>Obj Count: {objects.length}</div>
        <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
        <div>Offset: {viewport.offset.x.toFixed(0)}, {viewport.offset.y.toFixed(0)}</div>
        <div className="text-amber-500/80 mt-2">BH Radius (Rs): {(config.blackHoleMass * RS_FACTOR).toFixed(1)}</div>
      </div>

      {/* Hover Tooltip */}
      {hoveredObj && hoverInfo && (
        <div 
          className="absolute z-50 pointer-events-none p-3 rounded-xl bg-gray-900/95 border border-gray-700 shadow-xl backdrop-blur-md flex flex-col gap-1.5 min-w-[150px] animate-in fade-in duration-150"
          style={{
            left: Math.min(hoverInfo.x + 20, (containerRef.current?.clientWidth || 0) - 180), // Prevent overflow right
            top: Math.min(hoverInfo.y + 20, (containerRef.current?.clientHeight || 0) - 120), // Prevent overflow bottom
          }}
        >
           <div className="flex items-center justify-between border-b border-gray-700 pb-1 mb-1">
              <span className="font-bold text-gray-200 text-sm">{hoveredObj.type}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredObj.color }} />
           </div>
           
           <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-gray-400">
                <span>Mass:</span>
                <span className="text-cyan-300">{hoveredObj.mass.toFixed(2)} M</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Velocity:</span>
                <span className="text-green-300">{Math.hypot(hoveredObj.vel.x, hoveredObj.vel.y).toFixed(1)} c/s</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Distance:</span>
                <span className="text-amber-300">{Math.hypot(hoveredObj.pos.x, hoveredObj.pos.y).toFixed(0)} au</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default BlackHoleCanvas;