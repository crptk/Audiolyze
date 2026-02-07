import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import IdleVisualizer from "./scenes/IdleVisualizer";

export default function App() {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  function handleAudioUpload(file) {
    if (!file) return;

    setAudioLoaded(true);

    // Simulate processing / AI analysis
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
    }, 2500);
  }

  return (
    <div className="app-root">
      {/* Animated light leak edges */}
      {/* <div className="light-leak leak-1" />
      <div className="light-leak leak-2" /> */}

      {/* Background Visualizer */}
      <Canvas
        className={`bg-canvas ${audioLoaded ? "unblurred" : "blurred"}`}
        camera={{ position: [0, 0, 4], fov: 60 }}
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[2, 2, 2]} intensity={2} />
        <IdleVisualizer active={audioLoaded} />
      </Canvas>

      {/* Foreground UI */}
      {!audioLoaded && (
        <div className="landing-ui">
          <h1 className="title">Audiolyze</h1>
          <p className="subtitle">Your music, on stage.</p>

          <label className="upload-box">
            Import or Drag & Drop Music
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => handleAudioUpload(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {/* Processing Overlay */}
      {processing && (
        <div className="processing-overlay">
          <p>Analyzing your performance...</p>
        </div>
      )}
    </div>
  );
}
