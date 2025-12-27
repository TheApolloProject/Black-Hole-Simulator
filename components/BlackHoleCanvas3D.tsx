import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { G, RS_FACTOR, COLORS } from '../constants';
import { CelestialObject, SimulationConfig, Vector3, ViewportState, CelestialType } from '../types';

interface BlackHoleCanvas3DProps {
  config: SimulationConfig;
  objects: CelestialObject[];
  setObjects: React.Dispatch<React.SetStateAction<CelestialObject[]>>;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
}

// Physics simulation component
const PhysicsSimulator: React.FC<{
  config: SimulationConfig;
  objects: CelestialObject[];
  setObjects: React.Dispatch<React.SetStateAction<CelestialObject[]>>;
}> = ({ config, objects, setObjects }) => {
  useFrame(() => {
    if (config.isPaused) return;
    
    setObjects(prevObjects => {
      const baseDt = 0.016 * config.timeScale;
      const rs = config.blackHoleMass * RS_FACTOR;
      
      return prevObjects.map(obj => {
        const distSq = obj.pos.x * obj.pos.x + obj.pos.y * obj.pos.y + obj.pos.z * obj.pos.z;
        const dist = Math.sqrt(distSq);
        
        // Objects that fall into the event horizon become gas clouds
        if (dist < rs) {
          return { ...obj, type: CelestialType.GAS_CLOUD, radius: 0, mass: 0 };
        }
        
        let dt = baseDt;
        
        // Time dilation effect
        if (config.enableTimeDilation) {
          const ratio = Math.min(0.99, rs / dist);
          const dilationFactor = Math.sqrt(1 - ratio);
          dt = baseDt * dilationFactor;
        }
        
        // Gravitational force
        const forceMag = (G * config.blackHoleMass) / distSq;
        const acc = {
          x: -forceMag * (obj.pos.x / dist),
          y: -forceMag * (obj.pos.y / dist),
          z: -forceMag * (obj.pos.z / dist)
        };
        
        // Update velocity and position
        const newVel = {
          x: obj.vel.x + acc.x * dt,
          y: obj.vel.y + acc.y * dt,
          z: obj.vel.z + acc.z * dt
        };
        
        const newPos = {
          x: obj.pos.x + newVel.x * dt,
          y: obj.pos.y + newVel.y * dt,
          z: obj.pos.z + newVel.z * dt
        };
        
        // Update trail
        const newTrail = [...obj.trail, obj.pos];
        if (newTrail.length > 200) newTrail.shift();
        
        return { ...obj, pos: newPos, vel: newVel, trail: newTrail };
      }).filter(o => o.mass > 0);
    });
  });
  
  return null;
};

// Celestial object renderer
const CelestialObjectRenderer: React.FC<{
  obj: CelestialObject;
  config: SimulationConfig;
  onHover: (id: string | null) => void;
}> = ({ obj, config, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate gravitational lensing effect (simplified for 3D)
  const lensedPosition = useMemo(() => {
    if (!config.showLensing) return obj.pos;
    
    const dist = Math.sqrt(obj.pos.x ** 2 + obj.pos.y ** 2 + obj.pos.z ** 2);
    const re = Math.sqrt(4 * G * config.blackHoleMass);
    
    if (dist < 0.001) return obj.pos;
    
    const u = dist / re;
    const uSq = u * u;
    const theta1 = (dist + Math.sqrt(dist * dist + 4 * re * re)) / 2;
    const scale = theta1 / dist;
    
    return {
      x: obj.pos.x * scale,
      y: obj.pos.y * scale,
      z: obj.pos.z * scale
    };
  }, [obj.pos, config.blackHoleMass, config.showLensing]);
  
  // Create trail line geometry
  const trailPoints = useMemo(() => {
    if (obj.trail.length < 2) return [];
    return obj.trail.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [obj.trail]);
  
  return (
    <group>
      {/* Trail */}
      {trailPoints.length > 1 && (
        <Line
          points={trailPoints}
          color={obj.color}
          lineWidth={1 + obj.mass / 10}
          opacity={0.6}
          transparent
        />
      )}
      
      {/* Celestial body */}
      <Sphere
        ref={meshRef}
        args={[obj.radius, 32, 32]}
        position={[lensedPosition.x, lensedPosition.y, lensedPosition.z]}
        onPointerOver={() => onHover(obj.id)}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial
          color={obj.color}
          emissive={obj.color}
          emissiveIntensity={obj.type === CelestialType.STAR ? 1.0 : 0.3}
          roughness={0.5}
          metalness={0.2}
        />
      </Sphere>
    </group>
  );
};

// Black hole and accretion disk
const BlackHole: React.FC<{ mass: number; config: SimulationConfig }> = ({ mass, config }) => {
  const rs = mass * RS_FACTOR;
  const diskRadius = rs * 6;
  
  return (
    <group>
      {/* Event Horizon (black sphere) */}
      <Sphere args={[rs * 2.6, 64, 64]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>
      
      {/* Event Horizon Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[rs * 2.5, rs * 2.7, 64]} />
        <meshBasicMaterial color="#ffffff" opacity={0.2} transparent side={THREE.DoubleSide} />
      </mesh>
      
      {/* Accretion Disk */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[rs, diskRadius, 64]} />
        <meshBasicMaterial color="#ff5500" opacity={0.6} transparent side={THREE.DoubleSide} />
      </mesh>
      
      {/* Inner bright ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[rs, rs * 2, 64]} />
        <meshBasicMaterial color="#ff6600" opacity={0.9} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Grid component
const SpaceGrid: React.FC<{ config: SimulationConfig }> = ({ config }) => {
  if (!config.showGrid) return null;
  
  const gridSize = config.gridDensity;
  const gridExtent = 2000;
  const lines = [];
  
  // Create grid lines
  for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
    // X-direction lines
    lines.push(
      <Line
        key={`x-${i}`}
        points={[[-gridExtent, i, 0], [gridExtent, i, 0]]}
        color="#06b6d4"
        opacity={0.15}
        transparent
        lineWidth={1}
      />
    );
    // Y-direction lines
    lines.push(
      <Line
        key={`y-${i}`}
        points={[[i, -gridExtent, 0], [i, gridExtent, 0]]}
        color="#06b6d4"
        opacity={0.15}
        transparent
        lineWidth={1}
      />
    );
  }
  
  return <group>{lines}</group>;
};

// Camera controller to sync with viewport state
const CameraController: React.FC<{
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
}> = ({ viewport, setViewport }) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    if (camera) {
      camera.position.set(
        viewport.cameraPosition.x,
        viewport.cameraPosition.y,
        viewport.cameraPosition.z
      );
    }
  }, [camera, viewport.cameraPosition]);
  
  // Update viewport state when camera moves
  const handleChange = useCallback(() => {
    if (controlsRef.current) {
      setViewport(prev => ({
        ...prev,
        cameraPosition: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        },
        cameraTarget: {
          x: controlsRef.current.target.x,
          y: controlsRef.current.target.y,
          z: controlsRef.current.target.z
        }
      }));
    }
  }, [camera, setViewport]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      target={[viewport.cameraTarget.x, viewport.cameraTarget.y, viewport.cameraTarget.z]}
      onChange={handleChange}
      minDistance={100}
      maxDistance={5000}
    />
  );
};

// Main scene component
const Scene: React.FC<BlackHoleCanvas3DProps> = ({ config, objects, setObjects, viewport, setViewport }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[1000, 1000, 1000]} intensity={1.0} />
      <pointLight position={[-1000, -1000, -1000]} intensity={0.5} />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#ff6600" />
      
      {/* Camera Controls */}
      <CameraController viewport={viewport} setViewport={setViewport} />
      
      {/* Background Stars */}
      <Stars radius={10000} depth={100} count={8000} factor={4} saturation={0.5} fade speed={0.5} />
      
      {/* Grid */}
      <SpaceGrid config={config} />
      
      {/* Black Hole */}
      <BlackHole mass={config.blackHoleMass} config={config} />
      
      {/* Celestial Objects */}
      {objects.map(obj => (
        <CelestialObjectRenderer
          key={obj.id}
          obj={obj}
          config={config}
          onHover={setHoveredId}
        />
      ))}
      
      {/* Physics Simulation */}
      <PhysicsSimulator config={config} objects={objects} setObjects={setObjects} />
    </>
  );
};

// Main component
const BlackHoleCanvas3D: React.FC<BlackHoleCanvas3DProps> = (props) => {
  const { objects, viewport, config } = props;
  
  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <Canvas
        camera={{
          position: [viewport.cameraPosition.x, viewport.cameraPosition.y, viewport.cameraPosition.z],
          fov: 75,
          near: 1,
          far: 20000
        }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene {...props} />
      </Canvas>
      
      {/* UI Overlays */}
      <div className="absolute top-4 left-4 pointer-events-none select-none text-xs font-mono text-cyan-500/80 space-y-1 z-10">
        <div>Obj Count: {objects.length}</div>
      </div>
      
      <div className="absolute bottom-4 left-4 pointer-events-none select-none text-xs font-mono text-gray-400 space-y-1 z-10 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/5">
        <div>Zoom: {viewport.zoom.toFixed(2)}x</div>
        <div>Cam: ({viewport.cameraPosition.x.toFixed(0)}, {viewport.cameraPosition.y.toFixed(0)}, {viewport.cameraPosition.z.toFixed(0)})</div>
      </div>
      
      <div className="absolute bottom-4 right-4 pointer-events-none select-none text-xs font-mono text-gray-400 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/5 z-10">
        <div className="text-cyan-400 font-bold mb-1">3D Controls:</div>
        <div>Left Click + Drag: Rotate</div>
        <div>Right Click + Drag: Pan</div>
        <div>Scroll: Zoom</div>
      </div>
    </div>
  );
};

export default BlackHoleCanvas3D;
