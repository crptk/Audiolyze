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
  mouseSensitivity = 0.5, // 0.1 to 2.0
  resetRef = null,
  audioTuning = null
}) {
  const [beatData, setBeatData] = useState({ beatHit: 0, expansion: 0 });
  const [journeyActive, setJourneyActive] = useState(false);
  const [journeyProgress, setJourneyProgress] = useState(0);
  const visualizerGroupRef = useRef();
  const cameraRef = useRef();
  const controlsRef = useRef();

  // Journey from backend structural analysis (highest-energy sustained section)
  const journeys = aiParams?.journeys || [];

  // Expose reset function to parent
  useEffect(() => {
    if (resetRef) {
      resetRef.current = () => {
        // Reset camera orbit to default position
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.object.position.set(0, 0, 35);
          controlsRef.current.update();
        }

        // Reset journey state
        setJourneyActive(false);
        setJourneyProgress(0);
      };
    }
  }, [resetRef]);

  // Check for journey mode triggers using backend-detected journey
  useEffect(() => {
    if (!isPlaying || !journeyEnabled || journeys.length === 0) {
      if (journeyActive) {
        setJourneyActive(false);
        setJourneyProgress(0);
      }
      return;
    }

    const activeJourney = journeys.find(
      j => currentTime >= j.start && currentTime <= j.end
    );

    if (activeJourney) {
      const dur = activeJourney.duration ?? (activeJourney.end - activeJourney.start);
      const progress = (currentTime - activeJourney.start) / dur;

      setJourneyActive(true);
      setJourneyProgress(progress);
    } else if (journeyActive) {
      setJourneyActive(false);
      setJourneyProgress(0);
    }
  }, [
    currentTime,
    isPlaying,
    journeyEnabled,
    journeys,
    journeyActive
  ]);
  return (
    <Canvas
      camera={{ position: [0, 0, 35], fov: 60 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ camera }) => {
        cameraRef.current = camera;
      }}
    >
      {/* Smooth camera controls with momentum */}
      <OrbitControls
        ref={controlsRef}
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
        hue={beatData.hue ?? 0.78}
        saturation={beatData.saturation ?? 1.0}
        lightness={beatData.lightness ?? 0.6}
      />

      {/* Visualizer group (can move during journey) */}
      <group ref={visualizerGroupRef}>
        {/* Aurora Borealis Ring (beat-reactive aura) */}
        <AuroraRing
          beatHit={beatData.beatHit}
          bassStrength={beatData.bassStrength || 0}
          expansion={beatData.expansion}
          hue={beatData.hue ?? 0.78}
          saturation={beatData.saturation ?? 1.0}
          lightness={beatData.lightness ?? 0.6}
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
          audioTuning={audioTuning}
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