import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAIParams, fetchSoundCloudInfo, fetchSoundCloudDownload } from "./api/audiolyze";
import VisualizerScene from './components/VisualizerScene';
import TimelineControls from './components/TimelineControls';
import BackButton from './components/BackButton';
import StageSidebar from './components/StageSidebar';
import RoomHeader from './components/RoomHeader';
import RoomChat from './components/RoomChat';
import HostMiniplayer from './components/HostMiniplayer';
import { useRoom } from './context/RoomContext';
import { ENVIRONMENTS, pickRandomEnvironment } from './components/EnvironmentManager';
import './App.css';
import './styles/visualizer.css';
import './styles/timeline.css';
import './styles/stage-sidebar.css';
import './styles/room-header.css';
import './styles/room-chat.css';
import './styles/host-miniplayer.css';

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
  const { createRoom, updateNowPlaying, currentRoom, isHost, leaveRoom, publicRooms, joinRoom, 
    broadcastHostAction, onHostAction, setAudioSource, sendSyncState, uploadAudioFile,
    audienceAudioSource, audienceAiParams, audienceSync,
    initialVisualizerState, hostedRoom, isVisiting, returnToHostedRoom, endHostedRoom,
    userId } = useRoom();
  
  const isAudience = !!currentRoom && !isHost;
  
  // Filter out user's own room from public rooms list (for landing page + sidebar)
  const filteredPublicRooms = publicRooms.filter(room => room.hostId !== userId);

  const handleFileSelect = async (file) => {
    if (file && (file.type === 'audio/mpeg' || file.type === 'video/mp4' || file.name.endsWith('.m4v'))) {
      setIsLoading(true);
      setLoadingMessage('Preparing audio...');

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

      // Create a room when audio loads
      createRoom();
      updateNowPlaying(np);

      // Upload the audio file so audience can download it, then set the audio source
      uploadAudioFile(file).then(uploadResult => {
        if (uploadResult && uploadResult.ok) {
          setAudioSource(
            { type: 'upload', url: uploadResult.fileUrl, title: file.name },
            params || null
          );
        }
      }).catch(err => console.warn('Audio upload for sharing failed:', err));
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    if (audioContextRef.current?.state === "suspended") {
      try { await audioContextRef.current.resume(); } catch (e) { console.warn("AudioContext resume failed:", e); }
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
    // Host broadcasts play/pause
    if (isHost) {
      broadcastHostAction('play_pause', { isPlaying: !isPlaying });
    }
  };

  const handleSeek = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    if (isHost) {
      broadcastHostAction('seek', { currentTime: time });
    }
  };

  const handleSpeedChange = (speed) => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    if (isHost) {
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
  };

  const manualShapeChangeRef = useRef(false);

  const handleShapeChanged = (newShape) => {
    if (newShape) setCurrentShape(newShape);
    if (!manualShapeChangeRef.current) {
      const newEnv = pickRandomEnvironment(currentEnvironment);
      setCurrentEnvironment(newEnv);
      // Host broadcasts auto shape + env change to audience
      if (isHost) {
        broadcastHostAction('shape_change', { shape: newShape });
        broadcastHostAction('environment_change', { environment: newEnv });
      }
    }
    manualShapeChangeRef.current = false;
  };

  const handleManualShapeChange = (shape) => {
    manualShapeChangeRef.current = true;
    setCurrentShape(shape);
    if (isHost) {
      broadcastHostAction('shape_change', { shape });
    }
  };

  const loadSoundCloudTrack = useCallback(async (blobUrl, title) => {
    setIsLoading(true);
    setLoadingMessage('Preparing audio...');

    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const file = new File([blob], `${title}.mp3`, { type: 'audio/mpeg' });

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = blobUrl;
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

    // Create room if not already in one
    if (!currentRoom) createRoom();
    updateNowPlaying(np);

    // Broadcast audio source for audience (SoundCloud URL is already accessible)
    setAudioSource(
      { type: 'soundcloud', url: blobUrl, title },
      params
    );
  }, [currentRoom, createRoom, updateNowPlaying, setAudioSource]);

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
          const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
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
          const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
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
      const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
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
        const blobUrl = `http://127.0.0.1:8000${downloadData.file_url}`;
        await loadSoundCloudTrack(blobUrl, firstTrack.title);
      } else {
        setLoadingMessage(`Downloading: ${info.title}...`);
        const downloadData = await fetchSoundCloudDownload(soundcloudUrl.trim());
        if (!downloadData.ok) {
          setSoundcloudError(downloadData.error || 'Download failed');
          setIsLoading(false); setLoadingMessage(''); return;
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

  const resetAudioState = useCallback(() => {
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
    audienceLoadedSourceRef.current = null;
  }, []);

  const handleBackToMenu = () => {
    resetAudioState();
    // Leave room
    leaveRoom();
  };

  // Handle returning to hosted room from visiting another room
  const handleReturnToHostedRoom = useCallback(() => {
    resetAudioState();
    returnToHostedRoom();
    // The returned_to_room message will restore us to the host view
    // We need to reload our own audio - this will be handled by the room state update
  }, [resetAudioState, returnToHostedRoom]);

  // Handle ending hosted room while visiting
  const handleEndHostedRoom = useCallback(() => {
    endHostedRoom();
  }, [endHostedRoom]);

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

  // Subscribe to host actions for audience members
  useEffect(() => {
    if (!isAudience || !onHostAction) return;

    const unsubscribe = onHostAction((msg) => {
      const { action, payload } = msg;
      console.log('[v0] Audience received host_action:', action, payload);
      switch (action) {
        case 'play_pause':
          if (audioRef.current && payload.isPlaying !== undefined) {
            if (payload.isPlaying) {
              audioRef.current.play().catch(e => console.warn('Play failed:', e));
            } else {
              audioRef.current.pause();
            }
            setIsPlaying(payload.isPlaying);
          }
          break;
        case 'seek':
          if (audioRef.current && payload.currentTime !== undefined) {
            audioRef.current.currentTime = payload.currentTime;
            setCurrentTime(payload.currentTime);
          }
          break;
        case 'speed_change':
          if (audioRef.current && payload.speed !== undefined) {
            audioRef.current.playbackRate = payload.speed;
            setPlaybackSpeed(payload.speed);
          }
          break;
        case 'shape_change':
          if (payload.shape) {
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
  }, [isAudience, onHostAction]);

  // HOST: broadcast audio source to the server whenever audio loads
  // Also send periodic sync state while playing
  useEffect(() => {
    if (!isHost || !currentRoom) return;
    // Periodic sync: send playback position every 2s while playing
    const syncInterval = setInterval(() => {
      if (audioRef.current && isPlaying) {
        sendSyncState(audioRef.current.currentTime, true, audioRef.current.playbackRate);
      }
    }, 2000);
    return () => clearInterval(syncInterval);
  }, [isHost, currentRoom, isPlaying, sendSyncState]);

  // Keep a ref to audienceSync so the audio loading effect can read it without re-running
  const audienceSyncRef = useRef(audienceSync);
  useEffect(() => { audienceSyncRef.current = audienceSync; }, [audienceSync]);
  
  // Keep a ref to initialVisualizerState so the audio loading effect can read it once
  const initialVisualizerStateRef = useRef(initialVisualizerState);
  useEffect(() => { initialVisualizerStateRef.current = initialVisualizerState; }, [initialVisualizerState]);

  // AUDIENCE: load the host's audio when we receive the audio source
  const audienceLoadedSourceRef = useRef(null);
  useEffect(() => {
    if (!isAudience) return;
    if (!audienceAudioSource) return;

    // Avoid reloading the same source
    const sourceKey = JSON.stringify(audienceAudioSource);
    if (audienceLoadedSourceRef.current === sourceKey) return;
    audienceLoadedSourceRef.current = sourceKey;

    const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
    let audioUrl = audienceAudioSource.url;
    // If relative URL, prepend API base
    if (audioUrl && audioUrl.startsWith('/')) {
      audioUrl = apiBase + audioUrl;
    }

    // Clean up previous audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
    audioFiltersRef.current = null;

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => { setDuration(audio.duration); });
    audio.addEventListener('timeupdate', () => { setCurrentTime(audio.currentTime); });
    audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); });

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

    // Set AI params from host
    if (audienceAiParams) {
      setAiParams(audienceAiParams);
    }

    // Set now playing from audio source info
    setNowPlaying({ title: audienceAudioSource.title || 'Unknown', source: audienceAudioSource.type || 'stream' });
    setAudioLoaded(true);

    // Apply initial visualizer state (shape, environment, EQ, anaglyph) from host snapshot
    const vs = initialVisualizerStateRef.current;
    if (vs) {
      if (vs.shape) setCurrentShape(vs.shape);
      if (vs.environment) setCurrentEnvironment(vs.environment);
      if (vs.audioTuning) setAudioTuning(vs.audioTuning);
      if (vs.audioPlaybackTuning) setAudioPlaybackTuning(vs.audioPlaybackTuning);
      if (vs.anaglyphEnabled !== undefined) setAnaglyphEnabled(vs.anaglyphEnabled);
    }

    // Apply the last known sync state (late-joiner catch up) - read from ref, not state
    const syncSnapshot = audienceSyncRef.current;
    if (syncSnapshot) {
      audio.currentTime = syncSnapshot.currentTime || 0;
      audio.playbackRate = syncSnapshot.playbackSpeed || 1;
      setPlaybackSpeed(syncSnapshot.playbackSpeed || 1);
      setCurrentTime(syncSnapshot.currentTime || 0);
      if (syncSnapshot.isPlaying) {
        audio.play().catch(e => console.warn('Audience auto-play failed (browser policy):', e));
        setIsPlaying(true);
      }
    }
  }, [isAudience, audienceAudioSource, audienceAiParams]);

  // AUDIENCE: apply periodic sync corrections from host
  useEffect(() => {
    if (!isAudience || !audienceSync || !audioRef.current) return;
    const drift = Math.abs(audioRef.current.currentTime - audienceSync.currentTime);
    if (drift > 2) {
      // Snap to host position if drift is too large
      audioRef.current.currentTime = audienceSync.currentTime;
    }
    // Match play state
    if (audienceSync.isPlaying && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else if (!audienceSync.isPlaying && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    if (audienceSync.playbackSpeed && audioRef.current.playbackRate !== audienceSync.playbackSpeed) {
      audioRef.current.playbackRate = audienceSync.playbackSpeed;
      setPlaybackSpeed(audienceSync.playbackSpeed);
    }
  }, [isAudience, audienceSync]);

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
    // If we're a host joining another room, clean up current audio for the visited room
    if (isHost && currentRoom) {
      // Reset audio state but don't leave room - joinRoom will handle the visit
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (audioContextRef.current) { try { audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
      audioFiltersRef.current = null;
      setAnalyser(null);
      setAiParams(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setCurrentShape(null);
      audienceLoadedSourceRef.current = null;
    }
    joinRoom(room);
    setAudioLoaded(true); // Transition to visualizer view
  };

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

      {/* Host Miniplayer (shows when host is visiting another room) */}
      <HostMiniplayer
        visible={isVisiting && !!hostedRoom}
        hostedRoom={hostedRoom}
        onReturn={handleReturnToHostedRoom}
        onEnd={handleEndHostedRoom}
      />

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

      {/* Landing Screen (scrollable with hero + Stage section) */}
      <div ref={landingRef} className={`landing-screen ${audioLoaded ? 'fade-out' : ''}`}>
        {/* Hero Section */}
        <div className="hero-section">
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
                <svg className="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  onChange={(e) => { setSoundcloudUrl(e.target.value); setSoundcloudError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSoundCloudSubmit(); }}
                />
                <button className="soundcloud-submit" onClick={handleSoundCloudSubmit} disabled={!soundcloudUrl.trim()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
              {soundcloudError && <p className="soundcloud-error">{soundcloudError}</p>}
            </div>
          </div>

          {/* Scroll indicator */}
          {filteredPublicRooms.length > 0 && (
            <div className="scroll-indicator" onClick={scrollToStage}>
              <span className="scroll-indicator-text">Browse Stages</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
        </div>

        {/* Stage Section (browse public rooms) */}
        {filteredPublicRooms.length > 0 && (
          <div className="stage-section">
            <div className="stage-section-header">
              <h2 className="stage-title">Join a Stage</h2>
              <p className="stage-subtitle">Listen and vibe with others in real time</p>
            </div>

            <div className="stage-rooms-grid">
              {filteredPublicRooms.map((room) => (
                <div key={room.id} className="stage-room-card" onClick={() => handleJoinRoom(room)}>
                  <div className="room-card-preview">
                    <span className="room-card-visualizer-placeholder">Visualizer Preview</span>
                    <span className="room-card-live-badge">
                      <span className="live-dot"></span>
                      LIVE
                    </span>
                  </div>
                  <div className="room-card-info">
                    <div className="room-card-header">
                      <h3 className="room-card-name">{room.name}</h3>
                      <div className="room-card-audience">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        <span>{room.audienceCount}</span>
                      </div>
                    </div>
                    <p className="room-card-host">hosted by <span>{room.hostName}</span></p>
                    {room.nowPlaying && (
                      <div className="room-card-now-playing">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                        <span className="room-card-now-playing-text">{room.nowPlaying.title}</span>
                      </div>
                    )}
                    <button className="room-card-join-btn" onClick={(e) => { e.stopPropagation(); handleJoinRoom(room); }}>
                      JOIN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Controls */}
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
        onEnvironmentChange={(env) => {
          setCurrentEnvironment(env);
          if (isHost) broadcastHostAction('environment_change', { environment: env });
        }}
        onReset={handleReset}
        nowPlaying={nowPlaying}
        playlistQueue={playlistQueue}
        playlistIndex={playlistIndex}
        onNext={playNextInQueue}
        onPrevious={playPreviousInQueue}
        onPlaylistTrackSelect={playPlaylistTrack}
        anaglyphEnabled={anaglyphEnabled}
        onAnaglyphToggle={setAnaglyphEnabled}
        audioTuning={audioTuning}
        onAudioTuningChange={(val) => {
          setAudioTuning(val);
          if (tuningLinked) setAudioPlaybackTuning(val);
          if (isHost) broadcastHostAction('eq_change', { audioTuning: val, audioPlaybackTuning: tuningLinked ? val : audioPlaybackTuning });
        }}
        audioPlaybackTuning={audioPlaybackTuning}
        onAudioPlaybackTuningChange={(val) => {
          setAudioPlaybackTuning(val);
          if (tuningLinked) setAudioTuning(val);
          if (isHost) broadcastHostAction('eq_change', { audioTuning: tuningLinked ? val : audioTuning, audioPlaybackTuning: val });
        }}
        tuningLinked={tuningLinked}
        onTuningLinkedChange={setTuningLinked}
        isAudience={isAudience}
      />
    </div>
  );
}

export default App;
