'use client';

import { useState, useRef, useEffect } from 'react';
import { fetchAIParams } from "./api/audiolyze";
import VisualizerScene from './components/VisualizerScene';
import TimelineControls from './components/TimelineControls';
import BackButton from './components/BackButton';
import { ENVIRONMENTS, pickRandomEnvironment } from './components/EnvironmentManager';
import './App.css';
import './styles/visualizer.css';

function App() {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [aiParams, setAiParams] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [analyser, setAnalyser] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [currentEnvironment, setCurrentEnvironment] = useState(ENVIRONMENTS.FIREFLIES);
  
  useEffect(() => {
    console.log('[v0] App.jsx currentEnvironment changed to:', currentEnvironment);
  }, [currentEnvironment]);
  const [audioTuning, setAudioTuning] = useState({
    bass: 1.0,
    mid: 1.0,
    treble: 1.0,
    sensitivity: 1.0,
  });
  const [audioPlaybackTuning, setAudioPlaybackTuning] = useState({
    bass: 1.0,
    mid: 1.0,
    treble: 1.0,
    sensitivity: 1.0,
  });
  const [tuningLinked, setTuningLinked] = useState(true);
  
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const resetVisualizerRef = useRef(null);
  const audioFiltersRef = useRef(null);

  const handleFileSelect = async (file) => {
    if (file && (file.type === 'audio/mpeg' || file.type === 'video/mp4' || file.name.endsWith('.m4v'))) {
      setIsLoading(true);
      setLoadingMessage('Preparing audio...');

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

      // Setup Web Audio API for visualization + EQ filters
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      
      // Create EQ filter nodes
      const bassFilter = audioContext.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = 0; // dB, 0 = neutral

      const midFilter = audioContext.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1500;
      midFilter.Q.value = 1.0;
      midFilter.gain.value = 0;

      const trebleFilter = audioContext.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;
      trebleFilter.gain.value = 0;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;

      // Chain: source -> bass -> mid -> treble -> gain -> analyser -> destination
      const source = audioContext.createMediaElementSource(audio);
      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      
      audioContextRef.current = audioContext;
      audioFiltersRef.current = { bassFilter, midFilter, trebleFilter, gainNode };
      setAnalyser(analyserNode);

      setLoadingMessage('Analyzing with AI...');

      try {
        const params = await fetchAIParams(file);
        setLoadingMessage('Generating timeline...');
        setAiParams(params);
        
        // Brief pause so user sees the final message
        await new Promise(resolve => setTimeout(resolve, 600));
        setLoadingMessage('Launching visualizer...');
        await new Promise(resolve => setTimeout(resolve, 400));
      } catch (err) {
        console.error('AI processing failed:', err);
        setLoadingMessage('Starting visualizer...');
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      setAudioFile(file);
      setAudioLoaded(true);
      setIsLoading(false);
      setLoadingMessage('');
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
    
    // Reset camera and visualizer position
    if (resetVisualizerRef.current) {
      resetVisualizerRef.current();
    }
  };

  // When a shape changes (from backend timestamps or manual), also switch environment
  const handleShapeChanged = () => {
    setCurrentEnvironment(prev => {
      const next = pickRandomEnvironment(prev);
      console.log('[v0] Shape changed - switching environment:', prev, '->', next);
      return next;
    });
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
    audioFiltersRef.current = null;
    
    // Reset all state - analyser set to null FIRST so IdleVisualizer cleans up
    setAnalyser(null);
    setAudioFile(null);
    setAudioLoaded(false);
    setAiParams(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackSpeed(1);
    setCurrentShape(null);
    setCurrentEnvironment(ENVIRONMENTS.FIREFLIES);
    setAudioTuning({ bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0 });
    setAudioPlaybackTuning({ bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0 });
  };

  // Update audio EQ filters when playback tuning changes
  useEffect(() => {
    if (!audioFiltersRef.current) return;
    const { bassFilter, midFilter, trebleFilter, gainNode } = audioFiltersRef.current;
    
    // Convert 0-3 multiplier to dB gain: 1.0 = 0dB, 0 = -24dB, 3 = +12dB
    bassFilter.gain.value = (audioPlaybackTuning.bass - 1.0) * 12;
    midFilter.gain.value = (audioPlaybackTuning.mid - 1.0) * 12;
    trebleFilter.gain.value = (audioPlaybackTuning.treble - 1.0) * 12;
    gainNode.gain.value = audioPlaybackTuning.sensitivity;
  }, [audioPlaybackTuning]);

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
          currentEnvironment={currentEnvironment}
          onShapeChanged={handleShapeChanged}
          resetRef={resetVisualizerRef}
          audioTuning={audioTuning}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="gradient-overlay"></div>

      {/* Loading Screen */}
      {isLoading && (
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring spinner-ring-2"></div>
            </div>
            <p className="loading-message">{loadingMessage}</p>
          </div>
        </div>
      )}

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
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onShapeChange={setCurrentShape}
        currentEnvironment={currentEnvironment}
        onEnvironmentChange={setCurrentEnvironment}
        onReset={handleReset}
        audioTuning={audioTuning}
        onAudioTuningChange={(val) => {
          setAudioTuning(val);
          if (tuningLinked) setAudioPlaybackTuning(val);
        }}
        audioPlaybackTuning={audioPlaybackTuning}
        onAudioPlaybackTuningChange={(val) => {
          setAudioPlaybackTuning(val);
          if (tuningLinked) setAudioTuning(val);
        }}
        tuningLinked={tuningLinked}
        onTuningLinkedChange={setTuningLinked}
      />
    </div>
  );
}

export default App;
