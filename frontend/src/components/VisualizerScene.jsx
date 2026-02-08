'use client';

import { useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import IdleVisualizer from '../scenes/IdleVisualizer';
import StarField from './StarField';
import AuroraRing from './AuroraRing';
import EnvironmentManager from './EnvironmentManager';
import AnaglyphEffect from './AnaglyphEffect';

export default function VisualizerScene({
  audioFile = null,
  aiParams = null,
  isPlaying = false,
  analyser = null,
  currentTime = 0,
  manualShape = null,
  currentEnvironment = 'fireflies',
  onShapeChanged = null,
  resetRef = null,
  audioTuning = null,
  anaglyphEnabled = false,
}) {
  const [beatData, setBeatData] = useState({
    beatHit: 0, expansion: 0, bassStrength: 0,
    hue: 0.78, saturation: 1.0, lightness: 0.6,
  });

  const handleBeatUpdate = useCallback((data) => {
    setBeatData(data);
  }, []);

  // When IdleVisualizer triggers a shape change, notify parent to also switch environment
  const handleShapeChange = useCallback((newShape) => {
    if (onShapeChanged) onShapeChanged(newShape);
  }, [onShapeChanged]);



  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => {};
    }
  }, [resetRef]);

  return (
    <Canvas
      camera={{ position: [0, 0, 35], fov: 60 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.3} />

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI}
        minPolarAngle={0}
        zoomSpeed={0.5}
        minDistance={10}
        maxDistance={100}
      />

      <StarField
        beatHit={beatData.beatHit}
        expansion={beatData.expansion}
        hue={beatData.hue}
        saturation={beatData.saturation}
        lightness={beatData.lightness}
      />

      <AuroraRing
        beatHit={beatData.beatHit}
        bassStrength={beatData.bassStrength}
        expansion={beatData.expansion}
        hue={beatData.hue}
        saturation={beatData.saturation}
        lightness={beatData.lightness}
      />

      {/* Environment particles - always visible, switches on shape changes */}
      <EnvironmentManager
        currentEnv={currentEnvironment}
        hue={beatData.hue}
        saturation={beatData.saturation}
        lightness={beatData.lightness}
      />

      <IdleVisualizer
        analyser={analyser}
        aiParams={aiParams}
        isPlaying={isPlaying}
        onBeatUpdate={handleBeatUpdate}
        onShapeChange={handleShapeChange}
        currentTime={currentTime}
        manualShape={manualShape}
        audioTuning={audioTuning}
      />

      {/* Anaglyph 3D Effect */}
      <AnaglyphEffect enabled={anaglyphEnabled} />
    </Canvas>
  );
}
