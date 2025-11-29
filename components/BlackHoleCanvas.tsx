import React, { useRef, useEffect, useState, useCallback } from 'react';
import { G, RS_FACTOR, COLORS } from '../constants';
import { CelestialObject, SimulationConfig, Vector2, ViewportState, CelestialType } from '../types';

// Refined lensing calculation based on the gravitational lens equation
// Returns the primary image position (pos) and secondary inverted image position (pos2)
// along with their magnifications.
const calculateLensing = (p: Vector2, mass: number, showLensing: boolean) => {
    if (!showLensing) return { pos: p, mag: 1, pos2: null, mag2: 0 };
    
    // Einstein Radius (RE)
    // RE = sqrt(4GM). We keep the constant G scaling from the simulation.
    // This defines the scale of the lensing distortion.
    const re = Math.sqrt(4 * G * mass);
    const reSq = re * re;
    
    const rSq = p.x * p.x + p.y * p.y;
    const r = Math.sqrt(rSq);
    
    // Handle singularity/center case
    if (r < 0.001) {
        // Source is directly behind the BH. Forms an Einstein Ring at RE.
        // We map the point to RE.
        return { 
            pos: { x: (p.x / r || 1) * re, y: (p.y / r || 0) * re }, 
            mag: 1.0, 
            pos2: null, 
            mag2: 0 
        };
    }

    // Impact parameter normalized to Einstein radius
    const u = r / re;
    const uSq = u * u;
    const root = Math.sqrt(uSq + 4);
    
    // Magnification (μ)
    // Total magnification μ = (u^2 + 2) / (2u * sqrt(u^2 + 4))
    // We split this into primary (+) and secondary (-) image contributions
    const A = (uSq + 2) / (2 * u * root);
    // Clamp magnification to prevent visual artifacts
    const mag1 = Math.min(A + 0.5, 8.0);
    const mag2 = Math.min(A - 0.5, 8.0);

    // Primary Image (Outer): theta_+ = (beta + sqrt(beta^2 + 4*theta_E^2)) / 2
    // Reduces to: (r + sqrt(r^2 + 4*re^2)) / 2
    const theta1 = (r + Math.sqrt(rSq + 4 * reSq)) / 2;
    const scale1 = theta1 / r;
    
    // Secondary Image (Inner): theta_- = (beta - sqrt(beta^2 + 4*theta_E^2)) / 2
    // This image is on the opposite side, so the radius is negative relative to 'r' vector
    const theta2 = (r - Math.sqrt(rSq + 4 * reSq)) / 2;
    const scale2 = theta2 / r;

    return {
        pos: { x: p.x * scale1, y: p.y * scale1 },
        mag: mag1,
        pos2: { x: p.x * scale2, y: p.y * scale2 },
        mag2: mag2
    };
};

// Legacy wrapper for compatibility with existing code that expects just a Vector2
// Uses the primary image position
const getLensedPosition = (p: Vector2, mass: number, showLensing: boolean): Vector2 => {
    return calculateLensing(p, mass, showLensing).pos;
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
  twinklePhase: number;
  twinkleSpeed: number;
  color: string; // "r, g, b"
  isNebula?: boolean;
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

  // Initialize Background Stars & Structures
  useEffect(() => {
    if (backgroundStars.current.length > 0) return;
    
    const stars: BackgroundStar[] = [];
    const worldSize = 12000;
    
    // --- Helpers ---
    
    const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const randomColor = (options: string[]) => options[Math.floor(Math.random() * options.length)];
    
    const addStar = (x: number, y: number, size: number, alpha: number, color: string, speedMod: number = 1.0, isNebula: boolean = false) => {
        stars.push({
            pos: { x, y },
            size: size,
            baseAlpha: alpha,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: (0.2 + Math.random() * 0.8) * speedMod,
            color: color,
            isNebula
        });
    };

    // 1. NEBULAE (Background Gas Clouds)
    const createNebula = (cx: number, cy: number, radius: number, color: string, particles: number) => {
        for(let i = 0; i < particles; i++) {
            // Random point in circle
            const r = Math.sqrt(Math.random()) * radius;
            const theta = Math.random() * Math.PI * 2;
            const x = cx + r * Math.cos(theta);
            const y = cy + r * Math.sin(theta);
            
            // Large, faint puffs
            addStar(x, y, randomRange(40, 100), randomRange(0.02, 0.05), color, 0.1, true);
        }
    };

    // Generate a few large nebulae
    createNebula(-3000, -2000, 1500, "50, 0, 80", 60); // Dark Purple
    createNebula(4000, 3000, 2000, "0, 40, 60", 80);   // Deep Teal
    createNebula(-2000, 5000, 1200, "80, 20, 20", 50); // Deep Red

    // 2. GALAXIES
    const createGalaxy = (cx: number, cy: number, radius: number, color: string) => {
        const armCount = Math.floor(randomRange(2, 4));
        const twist = randomRange(3, 6);
        
        // Core
        for(let i=0; i<150; i++) {
             const r = Math.random() * radius * 0.15;
             const theta = Math.random() * Math.PI * 2;
             addStar(cx + r*Math.cos(theta), cy + r*Math.sin(theta), randomRange(1, 2.5), randomRange(0.5, 0.9), "255, 240, 200");
        }
        
        // Arms
        for(let i=0; i<500; i++) {
            const r = (i / 500) * radius;
            const armOffset = (Math.floor(Math.random() * armCount) / armCount) * Math.PI * 2;
            const curve = r * twist / radius;
            const scatter = (Math.random() - 0.5) * (radius * 0.2); // Scatter increases with radius?
            const angle = armOffset + curve;
            
            const x = cx + (r * Math.cos(angle)) + (Math.random()-0.5)*radius*0.1;
            const y = cy + (r * Math.sin(angle)) + (Math.random()-0.5)*radius*0.1;
            
            const isBlue = Math.random() > 0.3;
            const starColor = isBlue ? color : "255, 255, 255";
            addStar(x, y, randomRange(0.8, 2.0), randomRange(0.3, 0.8), starColor);
        }
    };

    createGalaxy(-3500, 2500, 1500, "150, 200, 255"); // Blue Spiral
    createGalaxy(4500, -1500, 1200, "200, 220, 255"); // Smaller Spiral
    createGalaxy(2000, 6000, 800, "255, 200, 200"); // Reddish Dwarf

    // 3. STAR CLUSTERS
    const createCluster = (cx: number, cy: number, count: number, spread: number, color: string) => {
        for(let i=0; i<count; i++) {
            // Gaussian-ish distribution
            const r = spread * Math.sqrt(-2 * Math.log(Math.random())); // Box-Muller radius approximation
            const theta = Math.random() * Math.PI * 2;
            const x = cx + r * Math.cos(theta);
            const y = cy + r * Math.sin(theta);
            
            addStar(x, y, randomRange(0.5, 2.0), randomRange(0.4, 0.9), color);
        }
    };

    createCluster(-1500, -4000, 100, 300, "100, 200, 255"); // Pleiades-like
    createCluster(3000, 1000, 150, 200, "255, 150, 50"); // Globular (orange)
    createCluster(-5000, 1000, 80, 250, "255, 255, 255");
    createCluster(1000, -5000, 120, 200, "200, 255, 200"); // Weird green one

    // 4. BACKGROUND FIELD
    const starColors = [
        "255, 255, 255", // White
        "200, 220, 255", // Blue-ish
        "255, 240, 200", // Yellow-ish
        "255, 200, 200"  // Red-ish
    ];

    for (let i = 0; i < 2500; i++) {
        stars.push({
            pos: {
                x: (Math.random() - 0.5) * 2 * worldSize,
                y: (Math.random() - 0.5) * 2 * worldSize
            },
            size: Math.random() * 1.5 + 0.5,
            baseAlpha: Math.random() * 0.6 + 0.1,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.2 + Math.random() * 0.8,
            color: starColors[Math.floor(Math.random() * starColors.length)]
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
    const time = performance.now() / 1000;

    // Clear Screen
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    const rs = config.blackHoleMass * RS_FACTOR; 
    
    const toScreen = (v: Vector2) => ({
      x: cx + (v.x + viewport.offset.x) * viewport.zoom,
      y: cy + (v.y + viewport.offset.y) * viewport.zoom
    });

    // --- DRAW BACKGROUND STARS & STRUCTURES ---
    // Helper to draw a single star instance
    const drawStarInstance = (pos: Vector2, mag: number, star: BackgroundStar) => {
        const screenPos = toScreen(pos);
        
        // Optimization: Cull off-screen stars
        // Increase cull margin for large nebula particles
        const margin = star.isNebula ? 200 : 20;
        if (screenPos.x < -margin || screenPos.x > w + margin || screenPos.y < -margin || screenPos.y > h + margin) return;

        // --- Refined Twinkling Logic ---
        
        // 1. Distance Influence:
        // Stars closer to BH twinkle more
        const distSq = pos.x * pos.x + pos.y * pos.y;
        const proximityFactor = Math.min(4.0, (rs * rs * 500) / (distSq + 100)); 

        // 2. Brightness Influence:
        const brightnessFactor = Math.sqrt(mag);

        // Dynamic Speed
        const dynamicSpeed = star.twinkleSpeed * (1 + proximityFactor + brightnessFactor * 0.5);

        // Dynamic Intensity
        // Nebulae shouldn't twinkle violently, just pulse slowly
        const dynamicIntensity = star.isNebula ? 0.05 : (0.15 + (proximityFactor * 0.15));

        // Calculate Alpha
        const noise = Math.sin(time * dynamicSpeed + star.twinklePhase) + 
                      Math.sin(time * dynamicSpeed * 1.7 + star.twinklePhase) * 0.4;
        
        const alphaOffset = noise * dynamicIntensity;

        // Modulate alpha by lensing magnification (flux conservation approximation)
        // Nebulae magnify less visually to prevent washing out screen
        const magEffect = star.isNebula ? Math.pow(mag, 0.3) : mag;
        const lensedAlpha = Math.min(1.0, star.baseAlpha * magEffect);
        
        // Final Alpha
        const currentAlpha = Math.max(0.01, Math.min(1.0, lensedAlpha + alphaOffset));

        // Draw
        ctx.fillStyle = `rgba(${star.color}, ${currentAlpha})`;
        ctx.beginPath();
        
        // Scale star size
        const pulse = 1 + alphaOffset * 0.3;
        const maxR = star.isNebula ? 300 : 6;
        const r = Math.min(star.size * viewport.zoom * Math.sqrt(magEffect) * pulse, maxR);
        
        ctx.arc(screenPos.x, screenPos.y, Math.max(0.2, r), 0, Math.PI * 2);
        ctx.fill();
    };

    backgroundStars.current.forEach(star => {
        // Lensing
        // For performance, maybe skip lensing calculation for very distant/faint stars?
        // But for correctness, we keep it. 
        const lensing = calculateLensing(star.pos, config.blackHoleMass, config.showLensing);
        
        // Draw Primary Image
        drawStarInstance(lensing.pos, lensing.mag, star);
        
        // Draw Secondary Image (if visible and not a huge nebula puff which might look weird inverted)
        if (config.showLensing && lensing.pos2 && lensing.mag2 > 0.02) {
             // Optional: Don't draw secondary images for nebulae to avoid clutter/artifacts in center
             if (!star.isNebula) {
                 drawStarInstance(lensing.pos2, lensing.mag2, star);
             }
        }
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
      
      // Vertical Lines
      for (let x = startX; x <= maxX; x += gridSize) {
        let first = true;
        for (let y = minY; y <= maxY; y += 20) {
          const worldPos = { x, y };
          const lensedWorld = calculateLensing(worldPos, config.blackHoleMass, config.showLensing).pos;
          const screenPos = toScreen(lensedWorld);
          
          if (first) {
            ctx.moveTo(screenPos.x, screenPos.y);
            first = false;
          } else {
            ctx.lineTo(screenPos.x, screenPos.y);
          }
        }
      }

      // Horizontal Lines
      for (let y = startY; y <= maxY; y += gridSize) {
        let first = true;
        for (let x = minX; x <= maxX; x += 20) {
          const worldPos = { x, y };
          const lensedWorld = calculateLensing(worldPos, config.blackHoleMass, config.showLensing).pos;
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
        // Trail
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

        // Body
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

    // --- DRAW SHADOW (Event Horizon) ---
    // The "Shadow" is the apparent size of the black hole, which is ~2.6 * Rs (3 * sqrt(3) / 2)
    // We draw this last to ensure it occludes everything behind it, including lensed stars
    const shadowRadius = rs * 2.6 * viewport.zoom;
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Photon Ring / Accretion Edge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1 * viewport.zoom;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
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
      
      {/* Overlay Info - Debug (Top Left) */}
      <div className="absolute top-4 left-4 pointer-events-none select-none text-xs font-mono text-cyan-500/80 space-y-1 z-10">
        <div>Frame Time: 16.6ms (60 FPS)</div>
        <div>Obj Count: {objects.length}</div>
      </div>

      {/* Overlay Info - Navigation (Bottom Left) */}
      <div className="absolute bottom-4 left-4 pointer-events-none select-none text-xs font-mono text-gray-400 space-y-1 z-10 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/5">
        <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
        <div>Offset: {viewport.offset.x.toFixed(0)}, {viewport.offset.y.toFixed(0)}</div>
        <div className="text-amber-500/80">BH Radius (Rs): {(config.blackHoleMass * RS_FACTOR).toFixed(1)}</div>
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