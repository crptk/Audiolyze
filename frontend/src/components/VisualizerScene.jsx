'use client';

import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import IdleVisualizer from '../scenes/IdleVisualizer';
import StarField from './StarField';
import AuroraRing from './AuroraRing';
import JourneyMode from './JourneyMode';

export default function VisualizerScene({ 
  audioFile = null, 
  aiParams = null,
  isPlaying = false,
  analyser = null,
  currentTime = 0,
  manualShape = null,
  journeyEnabled = true,
  mouseSensitivity = 0.5 // 0.1 to 2.0
}) {
  const [beatData, setBeatData] = useState({ beatHit: 0, expansion: 0 });
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const visualizerGroupRef = useRef();
  
  // Hardcoded journey timestamps (AI will provide these later)
  const JOURNEY_TIMESTAMPS = [
    { time: 45, duration: 10 }, // Journey at 45s for 10 seconds
    { time: 90, duration: 8 },
  ];

  // Check for journey mode triggers
  useEffect(() => {
    if (!isPlaying || !journeyEnabled) return;
    
    JOURNEY_TIMESTAMPS.forEach(journey => {
      const timeInJourney = currentTime - journey.time;
      
      if (timeInJourney >= 0 && timeInJourney < journey.duration) {
        if (!journeyActive) {
          console.log('[v0] Journey mode activated at', journey.time, 's');
          setJourneyActive(true);
        }
        // Smooth ease in/out progress
        const progress = timeInJourney / journey.duration;
        const smoothProgress = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setJourneyProgress(smoothProgress);
      } else if (timeInJourney >= journey.duration && journeyActive) {
        console.log('[v0] Journey mode deactivated');
        setJourneyActive(false);
        setJourneyProgress(0);
      }
    });
  }, [currentTime, isPlaying, journeyActive]);

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

      {/* Journey Mode - Flying particles and light streams */}
      <JourneyMode 
        isActive={journeyActive}
        journeyProgress={journeyProgress}
        visualizerRef={visualizerGroupRef}
      />

      {/* Visualizer group (can move during journey) */}
      <group ref={visualizerGroupRef}>
        {/* Aurora Borealis Ring (beat-reactive aura) */}
        <AuroraRing 
          beatHit={beatData.beatHit} 
          bassStrength={beatData.bassStrength || 0}
          expansion={beatData.expansion} 
        />

        {/* Particle Visualizer */}
        <IdleVisualizer 
          audioData={audioFile}
          analyser={analyser}
          aiParams={aiParams}
          isPlaying={isPlaying}
          currentTime={currentTime}
          manualShape={manualShape}
          onBeatUpdate={setBeatData}
        />
      </group>

      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={0.25}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.8}
          radius={0.4}
        />
      </EffectComposer>
    </Canvas>
  );
}
