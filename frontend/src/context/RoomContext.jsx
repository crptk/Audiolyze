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

  // ---- Hosted room state (persists when host visits another room or goes to menu) ----
  const [hostedRoom, setHostedRoom] = useState(null); // {id, name, nowPlaying, audienceCount, isPublic}
  const [isVisiting, setIsVisiting] = useState(false); // true when host is visiting another room
  const [isOnMenu, setIsOnMenu] = useState(false); // true when host went to main menu but room is alive
  
  // Data needed to reload host audio when returning to their room
  const [hostReturnData, setHostReturnData] = useState(null); // {audioSource, aiParams, lastSync}

  // ---- Audience sync state ----
  const [audienceAudioSource, setAudienceAudioSource] = useState(null);
  const [audienceAiParams, setAudienceAiParams] = useState(null);
  const [audienceSync, setAudienceSync] = useState(null);
  
  // Initial visualizer state received on join (separate from live host actions)
  const [initialVisualizerState, setInitialVisualizerState] = useState(null);

  // ---- Queue state ----
  const [queue, setQueue] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [mySuggestion, setMySuggestion] = useState(null); // audience's active pending suggestion

  // Queue event listeners (for App.jsx to handle queue_play_next)
  const queueListenersRef = useRef([]);

  // Host action queue - audience reads and clears these
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
        setIsVisiting(false);
        setIsOnMenu(false);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        setMembers(data.members || []);
        setMessages([]);
        setHostedRoom(null);
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        setInitialVisualizerState(null);
        setQueue([]);
        setSuggestions([]);
        setMySuggestion(null);
        break;

      case 'room_joined': {
        const room = data.room;
        setCurrentRoom(room);
        setIsHost(false);
        setRoomName(room.name);
        setIsPublic(room.isPublic);
        setMembers(data.members || []);
        setMessages(data.messages || []);
        
        // If we got a hostedRoom back, we're visiting
        if (data.hostedRoom) {
          setHostedRoom(data.hostedRoom);
          setIsVisiting(true);
        }
        
        // Set audience audio/sync state from the full room data
        setAudienceAudioSource(room.audioSource || null);
        setAudienceAiParams(room.aiParams || null);
        setAudienceSync(room.lastSync || null);
        
        // Store initial visualizer state separately so App.jsx can apply it after audio loads
        setInitialVisualizerState(room.hostVisualizerState || null);
        
        // Queue state
        setQueue(room.queue || []);
        setSuggestions(room.suggestions || []);
        setMySuggestion(null);
        break;
      }

      case 'went_to_menu':
        setCurrentRoom(null);
        setIsHost(false);
        setIsVisiting(false);
        setIsOnMenu(true);
        setRoomName('');
        setIsPublic(false);
        setMembers([]);
        setMessages([]);
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        setInitialVisualizerState(null);
        if (data.hostedRoom) {
          setHostedRoom(data.hostedRoom);
        }
        break;

      case 'returned_to_room': {
        const room = data.room;
        setCurrentRoom(room);
        setIsHost(true);
        setIsVisiting(false);
        setIsOnMenu(false);
        setRoomName(room.name);
        setIsPublic(room.isPublic);
        setMembers(data.members || []);
        setMessages(data.messages || []);
        // Provide audio data so App.jsx can reload the host's audio
        if (data.needsAudioReload && room.audioSource) {
          setHostReturnData({
            audioSource: room.audioSource,
            aiParams: room.aiParams || null,
            lastSync: room.lastSync || null,
            hostVisualizerState: room.hostVisualizerState || null,
          });
        }
        // Clear audience state - we're the host again
        setAudienceAudioSource(null);
        setAudienceAiParams(null);
        setAudienceSync(null);
        setInitialVisualizerState(null);
        setHostedRoom(null);
        break;
      }

      case 'hosted_room_ended':
        setHostedRoom(null);
        setIsVisiting(false);
        setIsOnMenu(false);
        break;

      case 'hosted_room_updated':
        if (data.hostedRoom) {
          setHostedRoom(data.hostedRoom);
        }
        break;

      case 'room_updated':
        setCurrentRoom(data.room);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        break;

      case 'user_joined':
        setMembers(data.members || []);
        if (data.systemMessage) setMessages(prev => [...prev, data.systemMessage]);
        // Update hosted room audience count if we're visiting
        setHostedRoom(prev => {
          if (!prev) return prev;
          // Audience count will be refreshed via public_rooms updates
          return prev;
        });
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
        setInitialVisualizerState(null);
        // If the closed room was our hosted room, clear that too
        setHostedRoom(null);
        setIsVisiting(false);
        setIsOnMenu(true);
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
        setInitialVisualizerState(null);
        break;

      case 'public_rooms':
        setPublicRooms(data.rooms || []);
        // Update hosted room info from public rooms if visiting
        setHostedRoom(prev => {
          if (!prev) return prev;
          const updated = (data.rooms || []).find(r => r.id === prev.id);
          if (updated) {
            return {
              ...prev,
              audienceCount: updated.audienceCount,
              nowPlaying: updated.nowPlaying,
              name: updated.name,
            };
          }
          return prev;
        });
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

      // ---- Queue messages ----
      case 'queue_update':
        setQueue(data.queue || []);
        setSuggestions(data.suggestions || []);
        break;

      case 'queue_play_next':
        // Dispatch to queue listeners (App.jsx handles playback)
        queueListenersRef.current.forEach(listener => {
          listener(data.item);
        });
        break;

      case 'new_suggestion':
        setSuggestions(prev => [...prev, data.suggestion]);
        break;

      case 'suggestion_sent':
        setMySuggestion(data.suggestion);
        break;

      case 'suggestion_response':
        if (data.action === 'approved' || data.action === 'rejected') {
          setMySuggestion(null);
        }
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

  const goToMenu = useCallback(() => {
    wsSend({ type: 'go_to_menu' });
  }, [wsSend]);

  const returnToHostedRoom = useCallback(() => {
    wsSend({ type: 'return_to_room' });
  }, [wsSend]);

  const clearHostReturnData = useCallback(() => {
    setHostReturnData(null);
  }, []);

  const endHostedRoom = useCallback(() => {
    wsSend({ type: 'end_room' });
    console.log('[RoomContext] sending end_room');
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

  // ---- Queue actions ----
  const queueAdd = useCallback((title, source, url, soundcloudUrl) => {
    wsSend({ type: 'queue_add', title, source, url, soundcloudUrl });
  }, [wsSend]);

  const queueRemove = useCallback((itemId) => {
    wsSend({ type: 'queue_remove', itemId });
  }, [wsSend]);

  const queueReorder = useCallback((order) => {
    wsSend({ type: 'queue_reorder', order }); // order = list of item IDs
  }, [wsSend]);

  const queueUpdateItem = useCallback((itemId, status, aiParams) => {
    wsSend({ type: 'queue_update_item', itemId, status, aiParams });
  }, [wsSend]);

  const queueAdvance = useCallback(() => {
    wsSend({ type: 'queue_advance' });
  }, [wsSend]);

  const suggestSong = useCallback((title, source, url) => {
    wsSend({ type: 'suggest_song', title, source, url });
  }, [wsSend]);

  const respondSuggestion = useCallback((suggestionId, action) => {
    wsSend({ type: 'respond_suggestion', suggestionId, action }); // action = "approve" | "reject"
  }, [wsSend]);

  const onQueuePlayNext = useCallback((listener) => {
    queueListenersRef.current.push(listener);
    return () => {
      queueListenersRef.current = queueListenersRef.current.filter(l => l !== listener);
    };
  }, []);

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
    // Hosted room (for miniplayer when visiting or on menu)
    hostedRoom, isVisiting, isOnMenu, goToMenu, returnToHostedRoom, endHostedRoom,
    hostReturnData, clearHostReturnData,
    // Audio sync
    setAudioSource, sendSyncState, broadcastHostAction, uploadAudioFile,
    audienceAudioSource, audienceAiParams, audienceSync,
    initialVisualizerState,
    onHostAction,
    // Queue
    queue, suggestions, mySuggestion,
    queueAdd, queueRemove, queueReorder, queueUpdateItem, queueAdvance,
    suggestSong, respondSuggestion, onQueuePlayNext,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
}

export default RoomContext;
