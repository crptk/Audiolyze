'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAIParams, fetchSoundCloudInfo, fetchSoundCloudDownload } from "./api/audiolyze";
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

  // SoundCloud state
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [soundcloudError, setSoundcloudError] = useState('');

  // Now playing info
  const [nowPlaying, setNowPlaying] = useState(null); // { title, source: 'file' | 'soundcloud' }

  // Playlist queue
  const [playlistQueue, setPlaylistQueue] = useState([]); // Array of { url, title }
  const [playlistIndex, setPlaylistIndex] = useState(-1);
  const isPlayingFromQueueRef = useRef(false);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [analyser, setAnalyser] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);
  const [currentEnvironment, setCurrentEnvironment] = useState(ENVIRONMENTS.FIREFLIES);


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
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = audioUrl;
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
      setNowPlaying({ title: file.name, source: 'file' });
      setAudioLoaded(true);
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // Audio control handlers
  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    // 🔑 Ensure AudioContext is running (SoundCloud fix)
    if (audioContextRef.current?.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn("AudioContext resume failed:", e);
      }
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        console.error("Audio play failed:", e);
        setIsPlaying(false);
      }
    }
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

  // When a shape changes from backend timestamps, also switch environment
  // manualShapeChangeRef tracks if the last change was manual to prevent auto-switching
  const manualShapeChangeRef = useRef(false);

  const handleShapeChanged = (newShape) => {
    // Update currentShape to reflect actual shape
    if (newShape) setCurrentShape(newShape);

    // Only auto-switch environment if it wasn't a manual change
    if (!manualShapeChangeRef.current) {
      setCurrentEnvironment(prev => {
        const next = pickRandomEnvironment(prev);
        return next;
      });
    }

    // Reset the flag after handling
    manualShapeChangeRef.current = false;
  };

  const handleManualShapeChange = (shape) => {
    manualShapeChangeRef.current = true;
    setCurrentShape(shape);
  };

  // Load a single SoundCloud track from a blob URL + title
  const loadSoundCloudTrack = useCallback(async (blobUrl, title) => {
    setIsLoading(true);
    setLoadingMessage('Preparing audio...');

    // Fetch the blob from the URL to create a File object for AI analysis
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const file = new File([blob], `${title}.mp3`, { type: 'audio/mpeg' });

    // Setup audio element
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = blobUrl;

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
      // If in a playlist, play next track
      if (isPlayingFromQueueRef.current) {
        playNextInQueue();
      }
    });

    // Setup Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;

    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = 0;

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
      await new Promise(resolve => setTimeout(resolve, 600));
      setLoadingMessage('Launching visualizer...');
      await new Promise(resolve => setTimeout(resolve, 400));
    } catch (err) {
      console.error('AI processing failed:', err);
      setLoadingMessage('Starting visualizer...');
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    setAudioFile(file);
    setNowPlaying({ title, source: 'soundcloud' });
    setAudioLoaded(true);
    setIsLoading(false);
    setLoadingMessage('');
  }, []);

  // Play next track in playlist queue
  const playNextInQueue = useCallback(async () => {
    setPlaylistIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx >= playlistQueue.length) {
        // End of playlist
        isPlayingFromQueueRef.current = false;
        return prev;
      }

      const nextTrack = playlistQueue[nextIdx];

      // Clean up current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      audioFiltersRef.current = null;
      setAnalyser(null);
      setAiParams(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setCurrentShape(null);

      // Download and load next track
      (async () => {
        setIsLoading(true);
        setLoadingMessage(`Downloading: ${nextTrack.title}...`);

        try {
          const downloadData = await fetchSoundCloudDownload(nextTrack.url);
          if (!downloadData.ok) {
            console.error('Failed to download track:', nextTrack.title);
            // Try next track
            isPlayingFromQueueRef.current = true;
            playNextInQueue();
            return;
          }

          const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
          await loadSoundCloudTrack(blobUrl, nextTrack.title);
        } catch (err) {
          console.error('Failed to download track:', nextTrack.title, err);
          // Try next track
          isPlayingFromQueueRef.current = true;
          playNextInQueue();
        }
      })();

      return nextIdx;
    });
  }, [playlistQueue, loadSoundCloudTrack]);

  // Play previous track in playlist queue
  const playPreviousInQueue = useCallback(async () => {
    setPlaylistIndex(prev => {
      const prevIdx = prev - 1;
      if (prevIdx < 0) {
        // At beginning of playlist
        return prev;
      }

      const prevTrack = playlistQueue[prevIdx];

      // Clean up current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      audioFiltersRef.current = null;
      setAnalyser(null);
      setAiParams(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setCurrentShape(null);

      // Download and load previous track
      (async () => {
        setIsLoading(true);
        setLoadingMessage(`Downloading: ${prevTrack.title}...`);

        try {
          const downloadData = await fetchSoundCloudDownload(prevTrack.url);
          if (!downloadData.ok) {
            console.error('Failed to download track:', prevTrack.title);
            return;
          }

          const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
          await loadSoundCloudTrack(blobUrl, prevTrack.title);
        } catch (err) {
          console.error('Failed to download track:', prevTrack.title, err);
        }
      })();

      return prevIdx;
    });
  }, [playlistQueue, loadSoundCloudTrack]);

  // Handle SoundCloud URL submission
  const handleSoundCloudSubmit = async () => {
    if (!soundcloudUrl.trim()) return;

    setSoundcloudError('');
    setIsLoading(true);
    setLoadingMessage('Fetching SoundCloud info...');

    try {
      // Step 1: Get info about the URL (track or playlist)
      const info = await fetchSoundCloudInfo(soundcloudUrl.trim());

      if (!info.ok) {
        setSoundcloudError(info.error || 'Failed to fetch SoundCloud info');
        setIsLoading(false);
        setLoadingMessage('');
        return;
      }

      if (info.type === 'playlist') {
        // Set up playlist queue, download first track immediately
        const tracks = info.tracks || [];
        if (tracks.length === 0) {
          setSoundcloudError('Playlist is empty');
          setIsLoading(false);
          setLoadingMessage('');
          return;
        }

        setPlaylistQueue(tracks);
        setPlaylistIndex(0);
        isPlayingFromQueueRef.current = true;

        const firstTrack = tracks[0];
        setLoadingMessage(`Downloading: ${firstTrack.title}...`);

        const downloadData = await fetchSoundCloudDownload(firstTrack.url);
        if (!downloadData.ok) {
          setSoundcloudError('Failed to download first track');
          setIsLoading(false);
          setLoadingMessage('');
          return;
        }

        const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
        await loadSoundCloudTrack(blobUrl, firstTrack.title);
      } else {
        // Single track
        setLoadingMessage(`Downloading: ${info.title}...`);

        const downloadData = await fetchSoundCloudDownload(soundcloudUrl.trim());
        if (!downloadData.ok) {
          setSoundcloudError(downloadData.error || 'Download failed');
          setIsLoading(false);
          setLoadingMessage('');
          return;
        }

        const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
        await loadSoundCloudTrack(blobUrl, info.title);
      }
    } catch (err) {
      console.error('SoundCloud error:', err);
      setSoundcloudError('Failed to process SoundCloud URL');
      setIsLoading(false);
      setLoadingMessage('');
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
    setNowPlaying(null);
    setPlaylistQueue([]);
    setPlaylistIndex(-1);
    isPlayingFromQueueRef.current = false;
    setSoundcloudUrl('');
    setSoundcloudError('');
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

          {/* SoundCloud Input */}
          <div className="soundcloud-section">
            <div className="soundcloud-divider">
              <span className="divider-line"></span>
              <span className="divider-text">or</span>
              <span className="divider-line"></span>
            </div>
            <div className="soundcloud-input-wrapper">
              <svg className="soundcloud-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.56 8.87V17h8.76c1.85 0 3.35-1.67 3.35-3.73 0-2.07-1.5-3.74-3.35-3.74-.34 0-.67.05-.98.14C18.87 6.66 16.5 4.26 13.56 4.26c-.84 0-1.63.2-2.33.56v4.05zm-1.3-3.2v11.33h-.5V6.4c-.5-.2-1.03-.31-1.59-.31-2.35 0-4.25 2.08-4.25 4.64 0 .4.05.79.14 1.17-.13-.01-.26-.02-.4-.02-1.85 0-3.35 1.59-3.35 3.56S1.81 19 3.66 19h5.1V5.67z" />
              </svg>
              <input
                type="text"
                className="soundcloud-input"
                placeholder="Paste a SoundCloud song or playlist link..."
                value={soundcloudUrl}
                onChange={(e) => {
                  setSoundcloudUrl(e.target.value);
                  setSoundcloudError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSoundCloudSubmit();
                }}
              />
              <button
                className="soundcloud-submit"
                onClick={handleSoundCloudSubmit}
                disabled={!soundcloudUrl.trim()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {soundcloudError && (
              <p className="soundcloud-error">{soundcloudError}</p>
            )}
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
        onShapeChange={handleManualShapeChange}
        currentEnvironment={currentEnvironment}
        onEnvironmentChange={setCurrentEnvironment}
        onReset={handleReset}
        nowPlaying={nowPlaying}
        playlistQueue={playlistQueue}
        playlistIndex={playlistIndex}
        onNext={playNextInQueue}
        onPrevious={playPreviousInQueue}
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
