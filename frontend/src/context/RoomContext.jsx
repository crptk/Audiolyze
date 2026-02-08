import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Random guest name generation
const ADJECTIVES = ['Cosmic', 'Neon', 'Stellar', 'Lunar', 'Solar', 'Astral', 'Nova', 'Vivid', 'Sonic', 'Drift', 'Echo', 'Blaze', 'Frost', 'Zen', 'Vibe'];
const NOUNS = ['Fox', 'Wolf', 'Hawk', 'Owl', 'Bear', 'Lynx', 'Crow', 'Moth', 'Orca', 'Stag', 'Raven', 'Puma', 'Heron', 'Viper', 'Drake'];

function generateGuestName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

const RoomContext = createContext(null);

function getWsUrl() {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
  return apiBase.replace(/^http/, 'ws') + '/rooms/ws';
}

function getRestUrl(path) {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
  return `${apiBase}${path}`;
}

export function RoomProvider({ children }) {
  // User identity
  const [username, setUsernameState] = useState(() => generateGuestName());
  const usernameRef = useRef(username);
  const [userId, setUserId] = useState(null);

  // Room state
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [members, setMembers] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // ---- Audience sync state ----
  // When audience joins, they receive the audio source + AI params + last sync + host visualizer state
  // These are used by App.jsx to load audio and sync playback
  const [audienceAudioSource, setAudienceAudioSource] = useState(null);
  const [audienceAiParams, setAudienceAiParams] = useState(null);
  const [audienceSync, setAudienceSync] = useState(null); // {currentTime, isPlaying, playbackSpeed, timestamp}

  // Host action queue - audience reads and clears these
  // Using a callback pattern so App.jsx can subscribe
  const hostActionListenersRef = useRef([]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => { usernameRef.current = username; }, [username]);

  // Stable send helper
  const wsSend = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Subscribe to host actions (audience side)
  const onHostAction = useCallback((listener) => {
    hostActionListenersRef.current.push(listener);
    return () => {
      hostActionListenersRef.current = hostActionListenersRef.current.filter(l => l !== listener);
    };
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }

    switch (data.type) {
      case 'connected':
        setUserId(data.userId);
        setPublicRooms(data.publicRooms || []);
        break;

      case 'username_set':
        setUsernameState(data.name);
        break;

      case 'room_created':
        setCurrentRoom(data.room);
        setIsHost(true);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        setMembers(data.members || []);
        setMessages([]);
        // Clear audience state since we're the host
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        break;

      case 'room_joined': {
        const room = data.room;
        setCurrentRoom(room);
        setIsHost(false);
        setRoomName(room.name);
        setIsPublic(room.isPublic);
        setMembers(data.members || []);
        setMessages(data.messages || []);
        // Set audience audio/sync state from the full room data
        setAudienceAudioSource(room.audioSource || null);
        setAudienceAiParams(room.aiParams || null);
        setAudienceSync(room.lastSync || null);
        // Apply host visualizer state if available
        if (room.hostVisualizerState) {
          const vs = room.hostVisualizerState;
          // Send as individual host_action events so App.jsx applies them
          if (vs.shape) {
            hostActionListenersRef.current.forEach(l => l({ action: 'shape_change', payload: { shape: vs.shape } }));
          }
          if (vs.environment) {
            hostActionListenersRef.current.forEach(l => l({ action: 'environment_change', payload: { environment: vs.environment } }));
          }
          if (vs.audioTuning) {
            hostActionListenersRef.current.forEach(l => l({ action: 'eq_change', payload: { audioTuning: vs.audioTuning, audioPlaybackTuning: vs.audioPlaybackTuning } }));
          }
        }
        break;
      }

      case 'room_updated':
        setCurrentRoom(data.room);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        break;

      case 'user_joined':
        setMembers(data.members || []);
        if (data.systemMessage) setMessages(prev => [...prev, data.systemMessage]);
        break;

      case 'user_left':
        setMembers(data.members || []);
        if (data.systemMessage) setMessages(prev => [...prev, data.systemMessage]);
        break;

      case 'user_renamed':
        setMembers(data.members || []);
        break;

      case 'chat_message':
        setMessages(prev => [...prev, data.message]);
        break;

      case 'room_closed':
        setCurrentRoom(null);
        setIsHost(false);
        setRoomName('');
        setIsPublic(false);
        setMembers([]);
        setMessages([]);
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        break;

      case 'left_room':
        setCurrentRoom(null);
        setIsHost(false);
        setRoomName('');
        setIsPublic(false);
        setMembers([]);
        setMessages([]);
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        break;

      case 'public_rooms':
        setPublicRooms(data.rooms || []);
        break;

      // ---- Audience sync messages ----
      case 'audio_source':
        setAudienceAudioSource(data.audioSource);
        setAudienceAiParams(data.aiParams);
        break;

      case 'sync_state':
        setAudienceSync({
          currentTime: data.currentTime,
          isPlaying: data.isPlaying,
          playbackSpeed: data.playbackSpeed,
          timestamp: data.timestamp,
        });
        break;

      case 'host_action':
        // Dispatch to all listeners (App.jsx subscribes)
        hostActionListenersRef.current.forEach(listener => {
          listener({ action: data.action, payload: data.payload || {} });
        });
        break;

      case 'error':
        console.warn('[Room] Server error:', data.message);
        break;

      default:
        break;
    }
  }, []);

  // Connect WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'set_username', name: usernameRef.current }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setIsConnected(false);
      if (!mountedRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    };

    ws.onerror = () => {};
  }, [handleMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // REST fallback for public rooms
  useEffect(() => {
    let cancelled = false;
    const fetchPublicRooms = async () => {
      try {
        const res = await fetch(getRestUrl('/rooms/public'));
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPublicRooms(data);
        }
      } catch { /* backend may not be running */ }
    };
    fetchPublicRooms();
    const interval = setInterval(() => {
      if (!isConnected) fetchPublicRooms();
    }, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isConnected]);

  // ---- Actions ----

  const setUsername = useCallback((name) => {
    const trimmed = (name || '').trim().slice(0, 30);
    if (!trimmed) return;
    setUsernameState(trimmed);
    wsSend({ type: 'set_username', name: trimmed });
  }, [wsSend]);

  const createRoom = useCallback((name) => {
    wsSend({ type: 'create_room', name: name || `${usernameRef.current}'s Stage` });
  }, [wsSend]);

  const joinRoom = useCallback((room) => {
    wsSend({ type: 'join_room', roomId: room.id });
  }, [wsSend]);

  const leaveRoom = useCallback(() => {
    wsSend({ type: 'leave_room' });
  }, [wsSend]);

  const togglePublic = useCallback(() => {
    wsSend({ type: 'toggle_public' });
  }, [wsSend]);

  const updateRoomName = useCallback((name) => {
    const trimmed = (name || '').trim().slice(0, 50);
    if (!trimmed) return;
    setRoomName(trimmed);
    wsSend({ type: 'rename_room', name: trimmed });
  }, [wsSend]);

  const updateNowPlaying = useCallback((nowPlaying) => {
    wsSend({ type: 'update_now_playing', nowPlaying });
  }, [wsSend]);

  const sendMessage = useCallback((text) => {
    const trimmed = (text || '').trim().slice(0, 500);
    if (!trimmed) return;
    wsSend({ type: 'chat_message', text: trimmed });
  }, [wsSend]);

  // ---- Host-only: broadcast audio source, sync, and actions ----

  const setAudioSource = useCallback((audioSource, aiParams) => {
    wsSend({ type: 'set_audio_source', audioSource, aiParams });
  }, [wsSend]);

  const sendSyncState = useCallback((currentTime, isPlaying, playbackSpeed) => {
    wsSend({ type: 'sync_state', currentTime, isPlaying, playbackSpeed });
  }, [wsSend]);

  const broadcastHostAction = useCallback((action, payload) => {
    wsSend({ type: 'host_action', action, payload });
  }, [wsSend]);

  // ---- Upload audio file (host only) ----
  const uploadAudioFile = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(getRestUrl('/rooms/upload-audio'), { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        return data; // {ok, fileUrl, filename}
      }
    } catch (err) {
      console.error('[Room] Audio upload failed:', err);
    }
    return null;
  }, []);

  const audience = members.filter(m => !m.isHost);

  const value = {
    username, userId, setUsername,
    currentRoom, isHost, roomName, isPublic, members, audience, publicRooms,
    messages, sendMessage,
    createRoom, joinRoom, leaveRoom, togglePublic, updateRoomName, updateNowPlaying,
    isConnected,
    // Audio sync
    setAudioSource, sendSyncState, broadcastHostAction, uploadAudioFile,
    audienceAudioSource, audienceAiParams, audienceSync,
    onHostAction,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
}

export default RoomContext;
