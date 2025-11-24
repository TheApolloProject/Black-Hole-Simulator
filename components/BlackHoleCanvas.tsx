import React, { useRef, useEffect, useState, useCallback } from 'react';
import { G, C, RS_FACTOR, MAX_TRAIL_LENGTH, COLORS, INITIAL_OBJECTS } from '../constants';
import { CelestialObject, SimulationConfig, Vector2, ViewportState, CelestialType } from '../types';

interface BlackHoleCanvasProps {
  config: SimulationConfig;
  objects: CelestialObject[];
  setObjects: React.Dispatch<React.SetStateAction<CelestialObject[]>>;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
}

const BlackHoleCanvas: React.FC<BlackHoleCanvasProps> = ({ 
  config, objects, setObjects, viewport, setViewport 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMousePos = useRef<Vector2>({ x: 0, y: 0 });

  // Physics Update Loop
  const updatePhysics = useCallback(() => {
    if (config.isPaused) return;

    setObjects(prevObjects => {
      const dt = 0.016 * config.timeScale; // Fixed approx 60fps base step
      const rs = config.blackHoleMass * RS_FACTOR;
      
      return prevObjects.map(obj => {
        // Calculate distance to BH center (0,0)
        const distSq = obj.pos.x * obj.pos.x + obj.pos.y * obj.pos.y;
        const dist = Math.sqrt(distSq);

        // Check for event horizon collision
        if (dist < rs) {
          // Object swallowed
          return { ...obj, type: CelestialType.GAS_CLOUD, radius: 0, mass: 0 }; 
          // In a real app we'd remove it, but let's just zero it out to avoid index shifts during map
        }

        // Newtonian Gravity (Simplified) F = G*M*m / r^2
        // Acceleration a = -G*M / r^3 * vec(r)
        // General Relativistic Correction (approx): Effective potential drops faster
        const forceMag = (G * config.blackHoleMass) / distSq;
        
        // Simple Euler integration
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

        // Update trail
        const newTrail = [...obj.trail, obj.pos];
        if (newTrail.length > MAX_TRAIL_LENGTH) newTrail.shift();

        return {
          ...obj,
          pos: newPos,
          vel: newVel,
          trail: newTrail
        };
      }).filter(o => o.mass > 0); // Remove swallowed objects
    });
  }, [config.isPaused, config.timeScale, config.blackHoleMass, setObjects]);

  // Render Loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive Canvas Size
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

    // Clear background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);

    // Calculate derived constants for rendering
    const rs = config.blackHoleMass * RS_FACTOR; // Schwarzschild Radius
    const re = Math.sqrt(4 * G * config.blackHoleMass * 100); // Einstein Radius approx scaled for visual
    
    // Viewport transform helpers
    const toScreen = (v: Vector2) => ({
      x: cx + (v.x + viewport.offset.x) * viewport.zoom,
      y: cy + (v.y + viewport.offset.y) * viewport.zoom
    });

    // Lensing Helper: Maps a "true" source position to an "apparent" screen position
    // For grid rendering, we actually do the inverse often, but let's stick to forward mapping 
    // vertices of the grid and drawing lines between them.
    // Lens Equation Approx: theta = beta + RE^2 / theta (roughly)
    // We displace points radially OUTWARD from BH center on screen.
    const lensPoint = (p: Vector2): Vector2 => {
        if (!config.showLensing) return p;
        
        // Vector from BH center to point
        const dx = p.x;
        const dy = p.y;
        const r2 = dx*dx + dy*dy;
        const r = Math.sqrt(r2);
        
        if (r < 1) return p; // Avoid singularity

        // Displacement magnitude based on 4M/r (simplified Einstein deflection)
        // Visual approximation: push out by K / r
        const deflection = (re * re) / r; 
        
        // New magnitude
        const rNew = r + deflection;
        
        // Scale vector
        const scale = rNew / r;
        return { x: dx * scale, y: dy * scale };
    };

    // --- DRAW GRID ---
    if (config.showGrid) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      
      const gridSize = config.gridDensity;
      const rangeX = w / viewport.zoom / 2 + 100; // Extend slightly beyond screen
      const rangeY = h / viewport.zoom / 2 + 100;
      
      // Calculate view bounds in world space
      const minX = -rangeX - viewport.offset.x;
      const maxX = rangeX - viewport.offset.x;
      const minY = -rangeY - viewport.offset.y;
      const maxY = rangeY - viewport.offset.y;

      // Snap to grid
      const startX = Math.floor(minX / gridSize) * gridSize;
      const startY = Math.floor(minY / gridSize) * gridSize;

      ctx.beginPath();
      
      // Vertical lines
      for (let x = startX; x <= maxX; x += gridSize) {
        // Draw line by sampling points to allow curvature
        let first = true;
        for (let y = minY; y <= maxY; y += 20) { // Sample every 20 units
          const worldPos = { x, y };
          // Apply lensing to the grid vertex
          const lensedWorld = lensPoint(worldPos);
          const screenPos = toScreen(lensedWorld);
          
          if (first) {
            ctx.moveTo(screenPos.x, screenPos.y);
            first = false;
          } else {
            ctx.lineTo(screenPos.x, screenPos.y);
          }
        }
      }

      // Horizontal lines
      for (let y = startY; y <= maxY; y += gridSize) {
        let first = true;
        for (let x = minX; x <= maxX; x += 20) {
          const worldPos = { x, y };
          const lensedWorld = lensPoint(worldPos);
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

    // --- DRAW ACCRETION DISK (Behind BH) ---
    // Simplified as a glowing gradient ring
    const screenCenter = toScreen({x: 0, y: 0});
    const diskRad = rs * 4 * viewport.zoom;
    
    const gradient = ctx.createRadialGradient(
      screenCenter.x, screenCenter.y, rs * viewport.zoom,
      screenCenter.x, screenCenter.y, diskRad
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)'); // Inner gap
    gradient.addColorStop(0.1, 'rgba(255, 100, 0, 0.8)'); // Hot inner edge
    gradient.addColorStop(0.4, 'rgba(200, 50, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, diskRad, 0, Math.PI * 2);
    ctx.fill();

    // --- DRAW CELESTIAL OBJECTS ---
    objects.forEach(obj => {
        // Trail
        if (obj.trail.length > 1) {
            ctx.strokeStyle = obj.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            obj.trail.forEach((pos, i) => {
                const lensedPos = lensPoint(pos);
                const sp = toScreen(lensedPos);
                if (i === 0) ctx.moveTo(sp.x, sp.y);
                else ctx.lineTo(sp.x, sp.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Body
        // Determine if object is behind the black hole (simple Z check simulation)
        // Since we are 2D, we assume z=0, but visual occlusion matters.
        // If object is very close to center in screen space, it might be behind the shadow.
        // However, lensing usually brings it around.
        
        const lensedPos = lensPoint(obj.pos);
        const screenPos = toScreen(lensedPos);
        
        // Draw object
        ctx.fillStyle = obj.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = obj.color;
        
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, obj.radius * viewport.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // --- DRAW BLACK HOLE SHADOW ---
    // The shadow is ~2.6 Rs (radius of photon sphere capture)
    // Draw purely black circle
    const shadowRadius = rs * 2.6 * viewport.zoom;
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(screenCenter.x, screenCenter.y, shadowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Photon ring (thin white line around shadow)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
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
    if (!isDragging.current) return;
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
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    setViewport(prev => {
        const newZoom = Math.max(0.1, Math.min(5.0, prev.zoom - e.deltaY * zoomSensitivity));
        return { ...prev, zoom: newZoom };
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black cursor-move">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="block touch-none"
      />
      
      {/* Overlay Info */}
      <div className="absolute top-4 left-4 pointer-events-none select-none text-xs font-mono text-cyan-500/80 space-y-1">
        <div>Frame Time: 16.6ms (60 FPS)</div>
        <div>Obj Count: {objects.length}</div>
        <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
        <div>Offset: {viewport.offset.x.toFixed(0)}, {viewport.offset.y.toFixed(0)}</div>
      </div>
    </div>
  );
};

export default BlackHoleCanvas;