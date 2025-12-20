import React, { useRef, useEffect, useState, useCallback } from 'react';
import { G, RS_FACTOR, COLORS } from '../constants';
import { CelestialObject, SimulationConfig, Vector2, ViewportState, CelestialType } from '../types';

// Refined lensing calculation based on the gravitational lens equation
const calculateLensing = (p: Vector2, mass: number, showLensing: boolean) => {
    if (!showLensing) return { pos: p, mag: 1, pos2: null, mag2: 0 };
    
    const re = Math.sqrt(4 * G * mass);
    const reSq = re * re;
    const rSq = p.x * p.x + p.y * p.y;
    const r = Math.sqrt(rSq);
    
    if (r < 0.001) {
        return { 
            pos: { x: (p.x / r || 1) * re, y: (p.y / r || 0) * re }, 
            mag: 1.0, 
            pos2: null, 
            mag2: 0 
        };
    }

    const u = r / re;
    const uSq = u * u;
    const root = Math.sqrt(uSq + 4);
    
    const A = (uSq + 2) / (2 * u * root);
    const mag1 = Math.min(A + 0.5, 8.0);
    const mag2 = Math.min(A - 0.5, 8.0);

    const theta1 = (r + Math.sqrt(rSq + 4 * reSq)) / 2;
    const scale1 = theta1 / r;
    
    const theta2 = (r - Math.sqrt(rSq + 4 * reSq)) / 2;
    const scale2 = theta2 / r;

    return {
        pos: { x: p.x * scale1, y: p.y * scale1 },
        mag: mag1,
        pos2: { x: p.x * scale2, y: p.y * scale2 },
        mag2: mag2
    };
};

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
  color: string;
  isNebula?: boolean;
  isGalaxy?: boolean;
  orbitCenter?: Vector2;
  orbitRadius?: number;
  initialAngle?: number;
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
  
  const galaxyRotationAccumulator = useRef(0);
  const lastTimeRef = useRef(0);
  
  const [hoverInfo, setHoverInfo] = useState<{ id: string, x: number, y: number } | null>(null);

  // Initialize Background Stars & Structures
  useEffect(() => {
    if (backgroundStars.current.length > 0) return;
    
    const stars: BackgroundStar[] = [];
    const worldSize = 14000;
    const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
    
    const addStar = (x: number, y: number, size: number, alpha: number, color: string, speedMod: number = 1.0, isNebula: boolean = false, isGalaxy: boolean = false, orbitCenter?: Vector2) => {
        let orbitRadius = 0;
        let initialAngle = 0;
        if (isGalaxy && orbitCenter) {
           const dx = x - orbitCenter.x;
           const dy = y - orbitCenter.y;
           orbitRadius = Math.sqrt(dx * dx + dy * dy);
           initialAngle = Math.atan2(dy, dx);
        }
        stars.push({
            pos: { x, y }, size, baseAlpha: alpha,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: (0.2 + Math.random() * 0.8) * speedMod,
            color, isNebula, isGalaxy, orbitCenter, orbitRadius, initialAngle
        });
    };

    const createNebula = (cx: number, cy: number, radius: number, color: string, particles: number) => {
        for(let i = 0; i < particles; i++) {
            const r = Math.sqrt(Math.random()) * radius;
            const theta = Math.random() * Math.PI * 2;
            addStar(cx + r * Math.cos(theta), cy + r * Math.sin(theta), randomRange(40, 100), randomRange(0.02, 0.05), color, 0.1, true);
        }
    };

    createNebula(-3000, -2000, 1500, "50, 0, 80", 60); 
    createNebula(4000, 3000, 2000, "0, 40, 60", 80);   
    createNebula(-2000, 5000, 1200, "80, 20, 20", 50); 

    const createGalaxy = (cx: number, cy: number, radius: number, color: string) => {
        const armCount = Math.floor(randomRange(2, 4));
        const twist = randomRange(3, 6);
        const orbitCenter = { x: cx, y: cy };
        for(let i=0; i<200; i++) {
             const r = Math.random() * radius * 0.15;
             const theta = Math.random() * Math.PI * 2;
             addStar(cx + r*Math.cos(theta), cy + r*Math.sin(theta), randomRange(1, 2.5), randomRange(0.5, 0.9), "255, 240, 200", 1.0, false, true, orbitCenter);
        }
        for(let i=0; i<600; i++) {
            const r = (i / 600) * radius;
            const armOffset = (Math.floor(Math.random() * armCount) / armCount) * Math.PI * 2;
            const curve = r * twist / radius;
            const angle = armOffset + curve;
            const x = cx + (r * Math.cos(angle)) + (Math.random()-0.5)*radius*0.1;
            const y = cy + (r * Math.sin(angle)) + (Math.random()-0.5)*radius*0.1;
            const isBlue = Math.random() > 0.3;
            addStar(x, y, randomRange(0.8, 2.0), randomRange(0.3, 0.8), isBlue ? color : "255, 255, 255", 1.0, false, true, orbitCenter);
        }
    };

    createGalaxy(-3500, 2500, 1500, "150, 200, 255");
    createGalaxy(4500, -1500, 1200, "200, 220, 255");
    createGalaxy(2000, 6000, 800, "255, 200, 200");

    const starColors = ["255, 255, 255", "220, 235, 255", "200, 220, 255", "255, 240, 200", "255, 220, 200"];
    for (let i = 0; i < 8000; i++) {
        const sizeRoll = Math.random();
        let size, brightness;
        if (sizeRoll > 0.99) {
            size = Math.random() * 2.5 + 1.2;
            brightness = Math.random() * 0.4 + 0.6;
        } else if (sizeRoll > 0.9) {
            size = Math.random() * 1.5 + 0.6;
            brightness = Math.random() * 0.3 + 0.4;
        } else {
            size = Math.random() * 0.6 + 0.2;
            brightness = Math.random() * 0.4 + 0.1;
        }
        stars.push({
            pos: { x: (Math.random() - 0.5) * 2 * worldSize, y: (Math.random() - 0.5) * 2 * worldSize },
            size, baseAlpha: brightness, twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.1 + Math.random() * 0.5,
            color: starColors[Math.floor(Math.random() * starColors.length)]
        });
    }
    backgroundStars.current = stars;
  }, []);

  const updatePhysics = useCallback(() => {
    if (config.isPaused) return;
    setObjects(prevObjects => {
      const baseDt = 0.016 * config.timeScale; 
      const rs = config.blackHoleMass * RS_FACTOR;
      return prevObjects.map(obj => {
        const distSq = obj.pos.x * obj.pos.x + obj.pos.y * obj.pos.y;
        const dist = Math.sqrt(distSq);
        if (dist < rs) return { ...obj, type: CelestialType.GAS_CLOUD, radius: 0, mass: 0 }; 
        let dt = baseDt;
        if (config.enableTimeDilation) {
            const ratio = Math.min(0.99, rs / dist);
            const dilationFactor = Math.sqrt(1 - ratio);
            dt = baseDt * dilationFactor;
        }
        const forceMag = (G * config.blackHoleMass) / distSq;
        const acc = { x: -forceMag * (obj.pos.x / dist), y: -forceMag * (obj.pos.y / dist) };
        const newVel = { x: obj.vel.x + acc.x * dt, y: obj.vel.y + acc.y * dt };
        const newPos = { x: obj.pos.x + newVel.x * dt, y: obj.pos.y + newVel.y * dt };
        const newTrail = [...obj.trail, obj.pos];
        if (newTrail.length > 200) newTrail.shift();
        return { ...obj, pos: newPos, vel: newVel, trail: newTrail };
      }).filter(o => o.mass > 0);
    });
  }, [config.isPaused, config.timeScale, config.blackHoleMass, config.enableTimeDilation, setObjects]);

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
    const now = performance.now() / 1000;
    if (lastTimeRef.current === 0) lastTimeRef.current = now;
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    galaxyRotationAccumulator.current += dt * config.galaxyRotationSpeed * 0.2;

    const cos = Math.cos(viewport.rotation);
    const sin = Math.sin(viewport.rotation);

    const toScreen = (v: Vector2) => {
        const rx = v.x + viewport.offset.x;
        const ry = v.y + viewport.offset.y;
        const rotX = rx * cos - ry * sin;
        const rotY = rx * sin + ry * cos;
        return { x: cx + rotX * viewport.zoom, y: cy + rotY * viewport.zoom };
    };

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
    const rs = config.blackHoleMass * RS_FACTOR; 
    
    const drawStarInstance = (pos: Vector2, mag: number, star: BackgroundStar) => {
        const screenPos = toScreen(pos);
        const margin = star.isNebula ? 200 : 20;
        if (screenPos.x < -margin || screenPos.x > w + margin || screenPos.y < -margin || screenPos.y > h + margin) return;
        const distSq = pos.x * pos.x + pos.y * pos.y;
        const proximityFactor = Math.min(4.0, (rs * rs * 500) / (distSq + 100)); 
        const brightnessFactor = Math.sqrt(mag);
        const dynamicSpeed = star.twinkleSpeed * (1 + proximityFactor + brightnessFactor * 0.5);
        const dynamicIntensity = star.isNebula ? 0.05 : (0.15 + (proximityFactor * 0.15));
        const noise = Math.sin(now * dynamicSpeed + star.twinklePhase) + 
                      Math.sin(now * dynamicSpeed * 1.7 + star.twinklePhase) * 0.4;
        const alphaOffset = noise * dynamicIntensity;
        const magEffect = star.isNebula ? Math.pow(mag, 0.3) : mag;
        const currentAlpha = Math.max(0.01, Math.min(1.0, (star.baseAlpha * magEffect) + alphaOffset));
        ctx.fillStyle = `rgba(${star.color}, ${currentAlpha})`;
        ctx.beginPath();
        const pulse = 1 + alphaOffset * 0.3;
        const r = Math.min(star.size * viewport.zoom * Math.sqrt(magEffect) * pulse, star.isNebula ? 300 : 6);
        ctx.arc(screenPos.x, screenPos.y, Math.max(0.2, r), 0, Math.PI * 2);
        ctx.fill();
    };

    backgroundStars.current.forEach(star => {
        let currentPos = star.pos;
        if (star.isGalaxy && star.orbitCenter && star.orbitRadius !== undefined && star.initialAngle !== undefined) {
            const currentAngle = star.initialAngle + galaxyRotationAccumulator.current;
            currentPos = {
                x: star.orbitCenter.x + star.orbitRadius * Math.cos(currentAngle),
                y: star.orbitCenter.y + star.orbitRadius * Math.sin(currentAngle)
            };
        }
        const lensing = calculateLensing(currentPos, config.blackHoleMass, config.showLensing);
        drawStarInstance(lensing.pos, lensing.mag, star);
        if (config.showLensing && lensing.pos2 && lensing.mag2 > 0.02 && !star.isNebula) {
            drawStarInstance(lensing.pos2, lensing.mag2, star);
        }
    });

    if (config.showGrid) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      const gridSize = config.gridDensity;
      const diag = Math.sqrt(w * w + h * h);
      const range = diag / viewport.zoom / 2 + 200;
      const minX = -range - viewport.offset.x;
      const maxX = range - viewport.offset.x;
      const minY = -range - viewport.offset.y;
      const maxY = range - viewport.offset.y;
      const startX = Math.floor(minX / gridSize) * gridSize;
      const startY = Math.floor(minY / gridSize) * gridSize;
      ctx.beginPath();
      for (let x = startX; x <= maxX; x += gridSize) {
        let first = true;
        for (let y = minY; y <= maxY; y += 40) { 
          const lensedWorld = calculateLensing({x, y}, config.blackHoleMass, config.showLensing).pos;
          const sp = toScreen(lensedWorld);
          if (first) { ctx.moveTo(sp.x, sp.y); first = false; } else ctx.lineTo(sp.x, sp.y);
        }
      }
      for (let y = startY; y <= maxY; y += gridSize) {
        let first = true;
        for (let x = minX; x <= maxX; x += 40) {
          const lensedWorld = calculateLensing({x, y}, config.blackHoleMass, config.showLensing).pos;
          const sp = toScreen(lensedWorld);
          if (first) { ctx.moveTo(sp.x, sp.y); first = false; } else ctx.lineTo(sp.x, sp.y);
        }
      }
      ctx.stroke();
    }

    const screenCenter = toScreen({x: 0, y: 0});
    const diskRad = rs * 6 * viewport.zoom;
    const gradient = ctx.createRadialGradient(screenCenter.x, screenCenter.y, rs * viewport.zoom, screenCenter.x, screenCenter.y, diskRad);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.15, 'rgba(255, 100, 0, 0.9)'); 
    gradient.addColorStop(0.3, 'rgba(255, 50, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, diskRad, 0, Math.PI * 2);
    ctx.fill();

    objects.forEach(obj => {
        if (obj.trail.length > 1) {
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 1 + (obj.mass / 10);
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            obj.trail.forEach((pos, i) => {
                const sp = toScreen(getLensedPosition(pos, config.blackHoleMass, config.showLensing));
                if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
        const sp = toScreen(getLensedPosition(obj.pos, config.blackHoleMass, config.showLensing));
        ctx.fillStyle = obj.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = obj.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, obj.radius * viewport.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    const shadowRadius = rs * 2.6 * viewport.zoom;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1 * viewport.zoom;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
    ctx.stroke();
  }, [config, objects, viewport]);

  useEffect(() => {
    const loop = () => { updatePhysics(); render(); requestRef.current = requestAnimationFrame(loop); };
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [updatePhysics, render]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const cos = Math.cos(viewport.rotation);
    const sin = Math.sin(viewport.rotation);
    if (isDragging.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const dWorldX = (dx * cos + dy * sin) / viewport.zoom;
        const dWorldY = (-dx * sin + dy * cos) / viewport.zoom;
        setViewport(prev => ({ ...prev, offset: { x: prev.offset.x + dWorldX, y: prev.offset.y + dWorldY } }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let foundId: string | null = null;
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.type === CelestialType.GAS_CLOUD) continue;
        const rx = getLensedPosition(obj.pos, config.blackHoleMass, config.showLensing).x + viewport.offset.x;
        const ry = getLensedPosition(obj.pos, config.blackHoleMass, config.showLensing).y + viewport.offset.y;
        const sx = canvasRef.current.width/2 + (rx * cos - ry * sin) * viewport.zoom;
        const sy = canvasRef.current.height/2 + (rx * sin + ry * cos) * viewport.zoom;
        if (Math.hypot(mx - sx, my - sy) <= Math.max(obj.radius * viewport.zoom, 8) + 5) { foundId = obj.id; break; }
    }
    if (foundId) setHoverInfo({ id: foundId, x: mx, y: my }); else setHoverInfo(null);
  };

  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseLeave = () => { isDragging.current = false; setHoverInfo(null); };
  const handleWheel = (e: React.WheelEvent) => {
    setViewport(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5.0, prev.zoom - e.deltaY * 0.001)) }));
  };

  const hoveredObj = hoverInfo ? objects.find(o => o.id === hoverInfo.id) : null;
  
  // Intelligent positioning logic
  const getTooltipStyles = () => {
    if (!hoverInfo || !containerRef.current) return { opacity: 0, visibility: 'hidden' as const };
    const { clientWidth, clientHeight } = containerRef.current;
    const isRight = hoverInfo.x > clientWidth * 0.7;
    const isBottom = hoverInfo.y > clientHeight * 0.7;
    const offsetX = isRight ? -190 : 20;
    const offsetY = isBottom ? -130 : 20;
    return {
        left: hoverInfo.x + offsetX,
        top: hoverInfo.y + offsetY,
        opacity: 1,
        visibility: 'visible' as const,
        transform: `translateY(${hoveredObj ? '0' : '10px'}) scale(${hoveredObj ? 1 : 0.95})`,
    };
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black cursor-move">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave} onWheel={handleWheel} className="block touch-none" />
      <div className="absolute top-4 left-4 pointer-events-none select-none text-xs font-mono text-cyan-500/80 space-y-1 z-10"><div>Obj Count: {objects.length}</div></div>
      <div className="absolute bottom-4 left-4 pointer-events-none select-none text-xs font-mono text-gray-400 space-y-1 z-10 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/5">
        <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
        <div>Rot: {(viewport.rotation * 180 / Math.PI).toFixed(0)}°</div>
      </div>

      {/* Improved Hover Tooltip with Fade & Smart Positioning */}
      <div 
        className="absolute z-50 pointer-events-none p-4 rounded-2xl bg-gray-900/80 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col gap-2 min-w-[170px] transition-all duration-300 ease-out"
        style={getTooltipStyles()}
      >
        {hoveredObj && (
            <>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-1">
                    <span className="font-bold text-white text-sm tracking-wide">{hoveredObj.type}</span>
                    <div className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20" style={{ backgroundColor: hoveredObj.color, boxShadow: `0 0 10px ${hoveredObj.color}` }} />
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-gray-400"><span>Mass:</span><span className="text-cyan-400">{hoveredObj.mass.toFixed(2)} M</span></div>
                    <div className="flex justify-between text-gray-400"><span>Vel:</span><span className="text-green-400">{Math.hypot(hoveredObj.vel.x, hoveredObj.vel.y).toFixed(1)} c/s</span></div>
                    <div className="flex justify-between text-gray-400"><span>Dist:</span><span className="text-amber-400">{Math.hypot(hoveredObj.pos.x, hoveredObj.pos.y).toFixed(0)} au</span></div>
                    {config.enableTimeDilation && (
                        <div className="flex justify-between text-gray-400 border-t border-white/5 pt-1.5 mt-1.5">
                            <span className="text-purple-400">Time:</span>
                            <span className="text-purple-300 font-bold">{Math.sqrt(Math.max(0, 1 - (config.blackHoleMass * RS_FACTOR) / Math.max(config.blackHoleMass * RS_FACTOR + 0.1, Math.hypot(hoveredObj.pos.x, hoveredObj.pos.y)))).toFixed(3)}x</span>
                        </div>
                    )}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default BlackHoleCanvas;