import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import IdleVisualizer from '../scenes/IdleVisualizer';

export default function VisualizerScene({ 
  audioFile = null, 
  aiParams = null,
  isPlaying = false 
}) {
  console.log('[v0] VisualizerScene rendering');
  
  return (
    <Canvas
      camera={{ position: [0, 0, 35], fov: 60 }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />

      {/* Jellyfish Visualizer */}
      <IdleVisualizer 
        audioData={audioFile} 
        aiParams={aiParams}
        isPlaying={isPlaying}
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
