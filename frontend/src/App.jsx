'use client';

import { useState, useRef, useEffect } from 'react';
import { fetchAIParams } from "./api/audiolyze";
import VisualizerScene from './components/VisualizerScene';
import TimelineControls from './components/TimelineControls';
import BackButton from './components/BackButton';
import './App.css';
import './styles/visualizer.css';

function App() {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [aiParams, setAiParams] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [analyser, setAnalyser] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [journeyEnabled, setJourneyEnabled] = useState(true);
  const [audioTuning, setAudioTuning] = useState({
    bass: 1.0,
    mid: 1.0,
    treble: 1.0,
    sensitivity: 1.0,
  });
  
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const resetVisualizerRef = useRef(null);

  const handleFileSelect = async (file) => {
    if (file && (file.type === 'audio/mpeg' || file.type === 'video/mp4' || file.name.endsWith('.m4v'))) {
      console.log('[v0] Audio file loaded:', file.name);
      setAudioFile(file);
      setAudioLoaded(true);

      // Setup audio element
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });

      // Setup Web Audio API for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      
      audioContextRef.current = audioContext;
      setAnalyser(analyserNode);
      
      console.log('[v0] Analyser created and set:', analyserNode);

      try {
        const params = await fetchAIParams(file);
        console.log('[v0] AI Params received:', params);
        setAiParams(params);
      } catch (err) {
        console.error('AI processing failed:', err);
      }
    }
  };

  // Audio control handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedChange = (speed) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleReset = () => {
    if (!audioRef.current) return;
    
    // Reset audio playback
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackSpeed(1);
    audioRef.current.playbackRate = 1;
    
    // Reset visualizer state
    setCurrentShape(null);
    setJourneyEnabled(true);
    
    // Reset camera and visualizer position
    if (resetVisualizerRef.current) {
      resetVisualizerRef.current();
    }
  };

  const handleBackToMenu = () => {
    // Clean up audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Reset all state
    setAudioFile(null);
    setAudioLoaded(false);
    setAiParams(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setAnalyser(null);
    setCurrentShape(null);
    setJourneyEnabled(true);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

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
      {/* Back Button */}
      <BackButton onClick={handleBackToMenu} visible={audioLoaded} />

      {/* Three.js Visualizer Background (blurred initially) */}
      <div className={`visualizer-background ${audioLoaded ? 'unblurred' : ''}`}>
        <VisualizerScene 
          audioFile={audioFile}
          aiParams={aiParams}
          isPlaying={isPlaying}
          analyser={analyser}
          currentTime={currentTime}
          manualShape={currentShape}
          journeyEnabled={journeyEnabled}
          resetRef={resetVisualizerRef}
          audioTuning={audioTuning}
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

      {/* Timeline Controls (fades in when AI params are ready) */}
      <TimelineControls
        audioFile={audioFile}
        aiParams={aiParams}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        currentShape={currentShape}
        journeyEnabled={journeyEnabled}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onShapeChange={setCurrentShape}
        onJourneyToggle={setJourneyEnabled}
        onReset={handleReset}
        audioTuning={audioTuning}
        onAudioTuningChange={setAudioTuning}
      />
    </div>
  );
}

export default App;
