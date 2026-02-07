'use client';

import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useState } from 'react';
import IdleVisualizer from '../scenes/IdleVisualizer';
import StarField from './StarField';
import AuroraRing from './AuroraRing';

export default function VisualizerScene({ 
  audioFile = null, 
  aiParams = null,
  isPlaying = false,
  analyser = null,
  currentTime = 0,
  manualShape = null,
  mouseSensitivity = 0.5 // 0.1 to 2.0
}) {
  const [beatData, setBeatData] = useState({ beatHit: 0, expansion: 0 });

  return (
    <Canvas
      camera={{ position: [0, 0, 35], fov: 60 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Smooth camera controls with momentum */}
      <OrbitControls 
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={mouseSensitivity}
        enableZoom={true}
        enablePan={false}
        minDistance={15}
        maxDistance={80}
        zoomSpeed={1.2}
      />

      {/* Star field environment (beat-reactive) */}
      <StarField beatHit={beatData.beatHit} expansion={beatData.expansion} />

      {/* Aurora Borealis Ring (beat-reactive aura) */}
      <AuroraRing 
        beatHit={beatData.beatHit} 
        bassStrength={beatData.bassStrength || 0}
        expansion={beatData.expansion} 
      />

      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />

      {/* Jellyfish Visualizer */}
      <IdleVisualizer 
        audioData={audioFile}
        analyser={analyser}
        aiParams={aiParams}
        isPlaying={isPlaying}
        currentTime={currentTime}
        manualShape={manualShape}
        onBeatUpdate={setBeatData}
      />

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.35}
          luminanceSmoothing={1.0}
        />
      </EffectComposer>
    </Canvas>
  );
}
