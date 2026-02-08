import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAIParams, fetchSoundCloudInfo, fetchSoundCloudDownload } from "./api/audiolyze";
import VisualizerScene from './components/VisualizerScene';
import TimelineControls from './components/TimelineControls';
import BackButton from './components/BackButton';
import StageSidebar from './components/StageSidebar';
import RoomHeader from './components/RoomHeader';
import RoomChat from './components/RoomChat';
import { useRoom } from './context/RoomContext';
import { ENVIRONMENTS, pickRandomEnvironment } from './components/EnvironmentManager';
import './App.css';
import './styles/visualizer.css';
import './styles/timeline.css';
import './styles/stage-sidebar.css';
import './styles/room-header.css';
import './styles/room-chat.css';

// Helper: get the API base URL
function getApiBase() {
  return import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
}

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
  const [nowPlaying, setNowPlaying] = useState(null);

  // Playlist queue
  const [playlistQueue, setPlaylistQueue] = useState([]);
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
  const [anaglyphEnabled, setAnaglyphEnabled] = useState(false);

  const [audioTuning, setAudioTuning] = useState({
    bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0,
  });
  const [audioPlaybackTuning, setAudioPlaybackTuning] = useState({
    bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0,
  });
  const [tuningLinked, setTuningLinked] = useState(true);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const resetVisualizerRef = useRef(null);
  const audioFiltersRef = useRef(null);
  const landingRef = useRef(null);

  // Room context
  const {
    createRoom, updateNowPlaying, currentRoom, isHost, leaveRoom,
    publicRooms, joinRoom,
    setAudioSource, sendSyncState, broadcastHostAction, uploadAudioFile,
    audienceAudioSource, audienceAiParams, audienceSync,
    onHostAction,
  } = useRoom();

  // Ref for isHost so callbacks don't go stale
  const isHostRef = useRef(isHost);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  // Ref for current playback state (for sync timer)
  const playbackStateRef = useRef({ currentTime: 0, isPlaying: false, playbackSpeed: 1 });
  useEffect(() => {
    playbackStateRef.current = { currentTime, isPlaying, playbackSpeed };
  }, [currentTime, isPlaying, playbackSpeed]);

  // ---- SHARED: Set up audio chain from a URL ----
  const setupAudioFromUrl = useCallback(async (audioUrl, skipAI = false) => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => { setDuration(audio.duration); });
    audio.addEventListener('timeupdate', () => { setCurrentTime(audio.currentTime); });
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (isPlayingFromQueueRef.current) playNextInQueue();
    });

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;

    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf'; bassFilter.frequency.value = 200; bassFilter.gain.value = 0;
    const midFilter = audioContext.createBiquadFilter();
    midFilter.type = 'peaking'; midFilter.frequency.value = 1500; midFilter.Q.value = 1.0; midFilter.gain.value = 0;
    const trebleFilter = audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf'; trebleFilter.frequency.value = 4000; trebleFilter.gain.value = 0;
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

    return { audio, audioContext, analyserNode };
  }, []);

  // ---- HOST: Handle local file select ----
  const handleFileSelect = async (file) => {
    if (file && (file.type === 'audio/mpeg' || file.type === 'video/mp4' || file.name.endsWith('.m4v'))) {
      setIsLoading(true);
      setLoadingMessage('Preparing audio...');

      const audioUrl = URL.createObjectURL(file);
      await setupAudioFromUrl(audioUrl);

      setLoadingMessage('Analyzing with AI...');

      let params = null;
      try {
        params = await fetchAIParams(file);
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
      const np = { title: file.name, source: 'file' };
      setNowPlaying(np);
      setAudioLoaded(true);
      setIsLoading(false);
      setLoadingMessage('');

      // Create room and upload file for audience
      createRoom();
      updateNowPlaying(np);

      // Upload file to backend so audience can download it
      setLoadingMessage('');
      const uploadResult = await uploadAudioFile(file);
      if (uploadResult && uploadResult.ok) {
        const fileUrl = `${getApiBase()}${uploadResult.fileUrl}`;
        setAudioSource({ type: 'upload', url: fileUrl, title: file.name }, params);
      }
    }
  };

  // ---- HOST: Play/Pause ----
  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    if (audioContextRef.current?.state === "suspended") {
      try { await audioContextRef.current.resume(); } catch (e) { console.warn("AudioContext resume failed:", e); }
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (isHostRef.current) {
        broadcastHostAction('pause', { currentTime: audioRef.current.currentTime, playbackSpeed });
      }
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        if (isHostRef.current) {
          broadcastHostAction('play', { currentTime: audioRef.current.currentTime, playbackSpeed });
        }
      } catch (e) {
        console.error("Audio play failed:", e);
        setIsPlaying(false);
      }
    }
  };

  // ---- HOST: Seek ----
  const handleSeek = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    if (isHostRef.current) {
      broadcastHostAction('seek', { time });
    }
  };

  // ---- HOST: Speed change ----
  const handleSpeedChange = (speed) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    if (isHostRef.current) {
      broadcastHostAction('speed_change', { speed });
    }
  };

  const handleReset = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackSpeed(1);
    audioRef.current.playbackRate = 1;
    setCurrentShape(null);
    if (resetVisualizerRef.current) resetVisualizerRef.current();
    if (isHostRef.current) {
      broadcastHostAction('reset', {});
    }
  };

  const manualShapeChangeRef = useRef(false);

  const handleShapeChanged = (newShape) => {
    if (newShape) setCurrentShape(newShape);
    if (!manualShapeChangeRef.current) {
      const newEnv = pickRandomEnvironment(currentEnvironment);
      setCurrentEnvironment(newEnv);
      if (isHostRef.current) {
        broadcastHostAction('shape_change', { shape: newShape });
        broadcastHostAction('environment_change', { environment: newEnv });
      }
    }
    manualShapeChangeRef.current = false;
  };

  const handleManualShapeChange = (shape) => {
    manualShapeChangeRef.current = true;
    setCurrentShape(shape);
    if (isHostRef.current) {
      broadcastHostAction('shape_change', { shape });
    }
  };

  const handleEnvironmentChange = (env) => {
    setCurrentEnvironment(env);
    if (isHostRef.current) {
      broadcastHostAction('environment_change', { environment: env });
    }
  };

  const handleAudioTuningChange = (tuning) => {
    setAudioTuning(tuning);
    if (isHostRef.current) {
      broadcastHostAction('eq_change', { audioTuning: tuning, audioPlaybackTuning });
    }
  };

  const handleAudioPlaybackTuningChange = (tuning) => {
    setAudioPlaybackTuning(tuning);
    if (isHostRef.current) {
      broadcastHostAction('eq_change', { audioTuning: audioTuning, audioPlaybackTuning: tuning });
    }
  };

  const handleAnaglyphToggle = (enabled) => {
    setAnaglyphEnabled(enabled);
    // Anaglyph is LOCAL only - don't broadcast
  };

  // ---- HOST: Periodic sync broadcast (every 2 seconds while playing) ----
  useEffect(() => {
    if (!isHost || !currentRoom) return;
    const interval = setInterval(() => {
      const state = playbackStateRef.current;
      if (state.isPlaying) {
        sendSyncState(state.currentTime, state.isPlaying, state.playbackSpeed);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isHost, currentRoom, sendSyncState]);

  // ---- HOST: SoundCloud track loading ----
  const loadSoundCloudTrack = useCallback(async (blobUrl, title) => {
    setIsLoading(true);
    setLoadingMessage('Preparing audio...');

    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const file = new File([blob], `${title}.mp3`, { type: 'audio/mpeg' });

    await setupAudioFromUrl(blobUrl);

    // Override the ended handler for playlists
    if (audioRef.current) {
      audioRef.current.removeEventListener('ended', () => {});
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        if (isPlayingFromQueueRef.current) playNextInQueue();
      });
    }

    setLoadingMessage('Analyzing with AI...');

    let params = null;
    try {
      params = await fetchAIParams(file);
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
    const np = { title, source: 'soundcloud' };
    setNowPlaying(np);
    setAudioLoaded(true);
    setIsLoading(false);
    setLoadingMessage('');

    // Create room if not already in one (host side)
    if (!currentRoom) createRoom();
    updateNowPlaying(np);

    // Broadcast audio source for audience
    if (isHostRef.current) {
      setAudioSource({ type: 'soundcloud', url: blobUrl, title }, params);
    }
  }, [currentRoom, createRoom, updateNowPlaying, setupAudioFromUrl, setAudioSource]);

  // ---- AUDIENCE: Load audio when audienceAudioSource changes ----
  const audienceLoadingRef = useRef(false);

  useEffect(() => {
    if (isHost || !audienceAudioSource || audienceLoadingRef.current) return;

    const loadAudienceAudio = async () => {
      audienceLoadingRef.current = true;
      setIsLoading(true);
      setLoadingMessage('Loading host audio...');

      try {
        // Clean up previous audio
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
        audioFiltersRef.current = null;
        setAnalyser(null);

        const audioUrl = audienceAudioSource.url;
        await setupAudioFromUrl(audioUrl);

        // Use AI params from host if provided
        if (audienceAiParams) {
          setAiParams(audienceAiParams);
        }

        const np = { title: audienceAudioSource.title || 'Unknown', source: audienceAudioSource.type || 'file' };
        setNowPlaying(np);
        setAudioLoaded(true);
        setIsLoading(false);
        setLoadingMessage('');

        // If host is currently playing, start playing too
        if (audienceSync && audienceSync.isPlaying) {
          // Calculate where the host is now accounting for network delay
          const elapsed = (Date.now() / 1000) - audienceSync.timestamp;
          const targetTime = audienceSync.currentTime + (elapsed * (audienceSync.playbackSpeed || 1));

          if (audioRef.current) {
            audioRef.current.currentTime = targetTime;
            audioRef.current.playbackRate = audienceSync.playbackSpeed || 1;
            setPlaybackSpeed(audienceSync.playbackSpeed || 1);
            try {
              if (audioContextRef.current?.state === "suspended") {
                await audioContextRef.current.resume();
              }
              await audioRef.current.play();
              setIsPlaying(true);
            } catch (e) {
              console.error('Audience autoplay failed:', e);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load audience audio:', err);
        setIsLoading(false);
        setLoadingMessage('');
      }

      audienceLoadingRef.current = false;
    };

    loadAudienceAudio();
  }, [isHost, audienceAudioSource, audienceAiParams, setupAudioFromUrl]);

  // ---- AUDIENCE: Handle sync state updates (drift correction) ----
  useEffect(() => {
    if (isHost || !audienceSync || !audioRef.current) return;

    const sync = audienceSync;
    const audio = audioRef.current;

    // Apply playback speed
    if (audio.playbackRate !== sync.playbackSpeed) {
      audio.playbackRate = sync.playbackSpeed;
      setPlaybackSpeed(sync.playbackSpeed);
    }

    // Apply play/pause state
    if (sync.isPlaying && audio.paused) {
      const resume = async () => {
        if (audioContextRef.current?.state === "suspended") {
          try { await audioContextRef.current.resume(); } catch (e) { /* ok */ }
        }
        try { await audio.play(); setIsPlaying(true); } catch (e) { /* autoplay blocked */ }
      };
      resume();
    } else if (!sync.isPlaying && !audio.paused) {
      audio.pause();
      setIsPlaying(false);
    }

    // Drift correction
    if (sync.isPlaying) {
      const elapsed = (Date.now() / 1000) - sync.timestamp;
      const targetTime = sync.currentTime + (elapsed * sync.playbackSpeed);
      const drift = Math.abs(audio.currentTime - targetTime);

      if (drift > 1.0) {
        // Large drift - snap
        audio.currentTime = targetTime;
      } else if (drift > 0.3) {
        // Small drift - gently correct by seeking
        audio.currentTime = targetTime;
      }
    } else {
      // Paused - snap to host position
      if (Math.abs(audio.currentTime - sync.currentTime) > 0.5) {
        audio.currentTime = sync.currentTime;
      }
    }
  }, [isHost, audienceSync]);

  // ---- AUDIENCE: Subscribe to host actions ----
  useEffect(() => {
    if (isHost) return;

    const unsubscribe = onHostAction((event) => {
      const { action, payload } = event;

      switch (action) {
        case 'play': {
          if (!audioRef.current) return;
          const resume = async () => {
            if (audioContextRef.current?.state === "suspended") {
              try { await audioContextRef.current.resume(); } catch (e) { /* ok */ }
            }
            if (payload.currentTime !== undefined) {
              audioRef.current.currentTime = payload.currentTime;
            }
            try { await audioRef.current.play(); setIsPlaying(true); } catch (e) { /* blocked */ }
          };
          resume();
          break;
        }
        case 'pause':
          if (audioRef.current) {
            audioRef.current.pause();
            if (payload.currentTime !== undefined) {
              audioRef.current.currentTime = payload.currentTime;
            }
          }
          setIsPlaying(false);
          break;
        case 'seek':
          if (audioRef.current && payload.time !== undefined) {
            audioRef.current.currentTime = payload.time;
            setCurrentTime(payload.time);
          }
          break;
        case 'speed_change':
          if (audioRef.current && payload.speed !== undefined) {
            audioRef.current.playbackRate = payload.speed;
            setPlaybackSpeed(payload.speed);
          }
          break;
        case 'reset':
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.playbackRate = 1;
          }
          setIsPlaying(false);
          setCurrentTime(0);
          setPlaybackSpeed(1);
          setCurrentShape(null);
          if (resetVisualizerRef.current) resetVisualizerRef.current();
          break;
        case 'shape_change':
          if (payload.shape) {
            manualShapeChangeRef.current = true;
            setCurrentShape(payload.shape);
          }
          break;
        case 'environment_change':
          if (payload.environment) {
            setCurrentEnvironment(payload.environment);
          }
          break;
        case 'eq_change':
          if (payload.audioTuning) setAudioTuning(payload.audioTuning);
          if (payload.audioPlaybackTuning) setAudioPlaybackTuning(payload.audioPlaybackTuning);
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [isHost, onHostAction]);

  // ---- Playlist navigation ----
  const playNextInQueue = useCallback(async () => {
    setPlaylistIndex(prev => {
      const nextIdx = prev + 1;
      if (nextIdx >= playlistQueue.length) {
        isPlayingFromQueueRef.current = false;
        return prev;
      }
      const nextTrack = playlistQueue[nextIdx];
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
      audioFiltersRef.current = null;
      setAnalyser(null); setAiParams(null); setIsPlaying(false); setCurrentTime(0); setDuration(0); setCurrentShape(null);

      (async () => {
        setIsLoading(true);
        setLoadingMessage(`Downloading: ${nextTrack.title}...`);
        try {
          const downloadData = await fetchSoundCloudDownload(nextTrack.url);
          if (!downloadData.ok) { playNextInQueue(); return; }
          const blobUrl = `${getApiBase()}${downloadData.file_url}`;
          await loadSoundCloudTrack(blobUrl, nextTrack.title);
        } catch (err) {
          console.error('Failed to download track:', nextTrack.title, err);
          isPlayingFromQueueRef.current = true;
          playNextInQueue();
        }
      })();
      return nextIdx;
    });
  }, [playlistQueue, loadSoundCloudTrack]);

  const playPreviousInQueue = useCallback(async () => {
    setPlaylistIndex(prev => {
      const prevIdx = prev - 1;
      if (prevIdx < 0) return prev;
      const prevTrack = playlistQueue[prevIdx];
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
      audioFiltersRef.current = null;
      setAnalyser(null); setAiParams(null); setIsPlaying(false); setCurrentTime(0); setDuration(0); setCurrentShape(null);

      (async () => {
        setIsLoading(true);
        setLoadingMessage(`Downloading: ${prevTrack.title}...`);
        try {
          const downloadData = await fetchSoundCloudDownload(prevTrack.url);
          if (!downloadData.ok) return;
          const blobUrl = `${getApiBase()}${downloadData.file_url}`;
          await loadSoundCloudTrack(blobUrl, prevTrack.title);
        } catch (err) {
          console.error('Failed to download track:', prevTrack.title, err);
        }
      })();
      return prevIdx;
    });
  }, [playlistQueue, loadSoundCloudTrack]);

  const playPlaylistTrack = useCallback(async (trackIndex) => {
    if (trackIndex < 0 || trackIndex >= playlistQueue.length) return;
    if (trackIndex === playlistIndex) return;
    const selectedTrack = playlistQueue[trackIndex];
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    audioFiltersRef.current = null;
    setAnalyser(null); setAiParams(null); setIsPlaying(false); setCurrentTime(0); setDuration(0); setCurrentShape(null);

    setIsLoading(true);
    setLoadingMessage(`Downloading: ${selectedTrack.title}...`);
    setPlaylistIndex(trackIndex);

    try {
      const downloadData = await fetchSoundCloudDownload(selectedTrack.url);
      if (!downloadData.ok) { setIsLoading(false); setLoadingMessage(''); return; }
      const blobUrl = `${getApiBase()}${downloadData.file_url}`;
      await loadSoundCloudTrack(blobUrl, selectedTrack.title);
    } catch (err) {
      console.error('Failed to download track:', selectedTrack.title, err);
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [playlistQueue, playlistIndex, loadSoundCloudTrack]);

  const handleSoundCloudSubmit = async () => {
    if (!soundcloudUrl.trim()) return;
    setSoundcloudError('');
    setIsLoading(true);
    setLoadingMessage('Fetching SoundCloud info...');

    try {
      const info = await fetchSoundCloudInfo(soundcloudUrl.trim());
      if (!info.ok) {
        setSoundcloudError(info.error || 'Failed to fetch SoundCloud info');
        setIsLoading(false); setLoadingMessage(''); return;
      }

      if (info.type === 'playlist') {
        const tracks = info.tracks || [];
        if (tracks.length === 0) {
          setSoundcloudError('Playlist is empty');
          setIsLoading(false); setLoadingMessage(''); return;
        }
        setPlaylistQueue(tracks);
        setPlaylistIndex(0);
        isPlayingFromQueueRef.current = true;
        const firstTrack = tracks[0];
        setLoadingMessage(`Downloading: ${firstTrack.title}...`);
        const downloadData = await fetchSoundCloudDownload(firstTrack.url);
        if (!downloadData.ok) {
          setSoundcloudError('Failed to download first track');
          setIsLoading(false); setLoadingMessage(''); return;
        }
        const blobUrl = `${getApiBase()}${downloadData.file_url}`;
        await loadSoundCloudTrack(blobUrl, firstTrack.title);
      } else {
        setLoadingMessage(`Downloading: ${info.title}...`);
        const downloadData = await fetchSoundCloudDownload(soundcloudUrl.trim());
        if (!downloadData.ok) {
          setSoundcloudError(downloadData.error || 'Download failed');
          setIsLoading(false); setLoadingMessage(''); return;
        }
        const blobUrl = `${getApiBase()}${downloadData.file_url}`;
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
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    audioFiltersRef.current = null;

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
    audienceLoadingRef.current = false;

    leaveRoom();
  };

  useEffect(() => {
    if (!audioFiltersRef.current) return;
    const { bassFilter, midFilter, trebleFilter, gainNode } = audioFiltersRef.current;
    bassFilter.gain.value = (audioPlaybackTuning.bass - 1.0) * 12;
    midFilter.gain.value = (audioPlaybackTuning.mid - 1.0) * 12;
    trebleFilter.gain.value = (audioPlaybackTuning.treble - 1.0) * 12;
    gainNode.gain.value = audioPlaybackTuning.sensitivity;
  }, [audioPlaybackTuning]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioContextRef.current) { audioContextRef.current.close(); }
    };
  }, []);

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const scrollToStage = () => {
    if (landingRef.current) {
      const stageSection = landingRef.current.querySelector('.stage-section');
      if (stageSection) stageSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleJoinRoom = (room) => {
    joinRoom(room);
    setAudioLoaded(true); // Transition to visualizer view
  };

  // When room is closed (host left), go back to menu
  useEffect(() => {
    if (!currentRoom && audioLoaded && !isHost) {
      // Room was closed while we were audience - go back
      handleBackToMenu();
    }
  }, [currentRoom, audioLoaded, isHost]);

  return (
    <div className="app-container">
      {/* Back Button */}
      <BackButton onClick={handleBackToMenu} visible={audioLoaded} />

      {/* Room Header (shows when in a room) */}
      <RoomHeader visible={audioLoaded} />

      {/* Stage Sidebar (shows when visualizer is active) */}
      <StageSidebar visible={audioLoaded} />

      {/* Room Chat (shows when in a room) */}
      <RoomChat visible={audioLoaded && currentRoom !== null} />

      {/* Three.js Visualizer Background */}
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
          anaglyphEnabled={anaglyphEnabled}
        />
      </div>

      {/* Gradient Overlay */}
      <div className="gradient-overlay"></div>

      {/* Animated Edge Glows */}
      <div className={`edge-glow ${audioLoaded ? 'fade-out' : ''}`}>
        <div className="edge-glow-blob edge-glow-blob--tl"></div>
        <div className="edge-glow-blob edge-glow-blob--tr"></div>
        <div className="edge-glow-blob edge-glow-blob--bl"></div>
        <div className="edge-glow-blob edge-glow-blob--br"></div>
      </div>

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

      {/* Landing Screen */}
      <div ref={landingRef} className={`landing-screen ${audioLoaded ? 'fade-out' : ''}`}>
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="hero-title-gradient">Audiolyze</span>
            </h1>
            <p className="hero-subtitle">Your music, on stage.</p>

            {/* File Upload Area */}
            <div
              className={`upload-area ${isDragging ? 'dragging' : ''}`}
              onClick={() => document.getElementById('file-input').click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <p className="upload-text">Import or Drag & Drop Music<br />to get started.</p>
              <svg className="upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              <p className="upload-formats">Accepted: .mp3, .m4v</p>
              <input
                id="file-input"
                type="file"
                accept=".mp3,.m4v,audio/mpeg,video/mp4"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </div>

            {/* SoundCloud Input */}
            <div className="soundcloud-input-wrapper">
              <div className="soundcloud-input-row">
                <input
                  type="text"
                  className="soundcloud-input"
                  placeholder="Paste a SoundCloud URL..."
                  value={soundcloudUrl}
                  onChange={(e) => setSoundcloudUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSoundCloudSubmit(); }}
                />
                <button
                  className="soundcloud-submit"
                  onClick={handleSoundCloudSubmit}
                  disabled={!soundcloudUrl.trim()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.56 8.87V17h8.76c1.85 0 3.35-1.67 3.35-3.73 0-2.07-1.5-3.74-3.35-3.74-.34 0-.67.05-.98.14C18.87 6.66 16.5 4.26 13.56 4.26c-.84 0-1.63.2-2.33.56v4.05zm-1.3-3.2v11.33h-.5V6.4c-.5-.2-1.03-.31-1.59-.31-2.35 0-4.25 2.08-4.25 4.64 0 .4.05.79.14 1.17-.13-.01-.26-.02-.4-.02-1.85 0-3.35 1.59-3.35 3.56S1.81 19 3.66 19h5.1V5.67z"/>
                  </svg>
                </button>
              </div>
              {soundcloudError && <p className="soundcloud-error">{soundcloudError}</p>}
            </div>

            {/* Scroll indicator */}
            {publicRooms.length > 0 && (
              <button className="scroll-indicator" onClick={scrollToStage}>
                <span>Join a Stage</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          </div>
        </section>

        {/* Stage Section (scroll down) */}
        {publicRooms.length > 0 && (
          <section className="stage-section">
            <h2 className="stage-title">Join a Stage</h2>
            <div className="stage-grid">
              {publicRooms.map(room => (
                <div key={room.id} className="stage-card">
                  <div className="stage-card-header">
                    <span className="stage-host-name">{room.hostName || 'Unknown'}</span>
                    <span className="stage-live-badge">LIVE</span>
                  </div>
                  <div className="stage-card-preview">
                    <div className="stage-preview-placeholder">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1">
                        <circle cx="12" cy="12" r="10" />
                        <polygon points="10 8 16 12 10 16 10 8" fill="rgba(255,255,255,0.3)" />
                      </svg>
                    </div>
                  </div>
                  <div className="stage-card-footer">
                    {room.nowPlaying && (
                      <p className="stage-now-playing">
                        Now playing: {room.nowPlaying.title}
                      </p>
                    )}
                    <div className="stage-card-meta">
                      <span className="stage-audience-count">
                        {room.audienceCount} listening
                      </span>
                      <button
                        className="stage-join-button"
                        onClick={() => handleJoinRoom(room)}
                      >
                        JOIN
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Timeline Controls (bottom of screen when visualizer is active) */}
      <TimelineControls
        audioFile={audioFile}
        aiParams={aiParams}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onShapeChange={handleManualShapeChange}
        currentShape={currentShape}
        currentEnvironment={currentEnvironment}
        onEnvironmentChange={handleEnvironmentChange}
        onReset={handleReset}
        nowPlaying={nowPlaying}
        playlistQueue={playlistQueue}
        playlistIndex={playlistIndex}
        onNext={playNextInQueue}
        onPrevious={playPreviousInQueue}
        onPlaylistTrackSelect={playPlaylistTrack}
        anaglyphEnabled={anaglyphEnabled}
        onAnaglyphToggle={handleAnaglyphToggle}
        audioTuning={audioTuning}
        onAudioTuningChange={handleAudioTuningChange}
        audioPlaybackTuning={audioPlaybackTuning}
        onAudioPlaybackTuningChange={handleAudioPlaybackTuningChange}
        tuningLinked={tuningLinked}
        onTuningLinkedChange={setTuningLinked}
        isAudience={!isHost && currentRoom !== null}
      />
    </div>
  );
}

export default App;
