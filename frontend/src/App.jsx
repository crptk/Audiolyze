'use client';

import { useState } from 'react';
import VisualizerScene from './components/VisualizerScene';
import './App.css';
import './styles/visualizer.css';

function App() {
  console.log('[v0] App component rendering');
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [aiParams, setAiParams] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file) => {
    if (file && (file.type === 'audio/mpeg' || file.type === 'video/mp4' || file.name.endsWith('.m4v'))) {
      console.log('[v0] Audio file loaded:', file.name);
      setAudioFile(file);
      setAudioLoaded(true);
      
      // TODO: Send audio file to backend for AI analysis
      // fetchAIParams(file).then(params => setAiParams(params));
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div className="app-container">
      {/* Three.js Visualizer Background (blurred initially) */}
      <div className={`visualizer-background ${audioLoaded ? 'unblurred' : ''}`}>
        <VisualizerScene 
          audioFile={audioFile}
          aiParams={aiParams}
          isPlaying={audioLoaded}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="gradient-overlay"></div>

      {/* Landing Screen UI (fades out after audio loads) */}
      <div className={`landing-screen ${audioLoaded ? 'fade-out' : ''}`}>
        <div className="content-wrapper">
          <h1 className="title">Audiolyze</h1>
          <p className="tagline">Your music, on stage.</p>

          <div
            className={`upload-box ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <div className="upload-content">
              <p className="upload-text">
                Import or Drag & Drop Music
                <br />
                to get started.
              </p>
              
              <svg
                className="upload-icon"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>

              <p className="accepted-formats">Accepted: .mp3, .m4v</p>
            </div>

            <input
              id="file-input"
              type="file"
              accept=".mp3,.m4v,audio/mpeg,video/mp4"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
