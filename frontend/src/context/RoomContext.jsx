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

// Build WebSocket URL from the API base (convert http to ws)
function getWsUrl() {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
  const wsBase = apiBase.replace(/^http/, 'ws');
  return `${wsBase}/rooms/ws`;
}

export function RoomProvider({ children }) {
  // User identity
  const [username, setUsernameState] = useState(() => generateGuestName());
  const [userId, setUserId] = useState(null);

  // Room state
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Members in current room
  const [members, setMembers] = useState([]);

  // Public rooms list (from server)
  const [publicRooms, setPublicRooms] = useState([]);

  // Chat messages
  const [messages, setMessages] = useState([]);

  // WebSocket ref
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isConnectedRef = useRef(false);

  // ------ WebSocket send helper ------
  const wsSend = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ------ Handle incoming messages ------
  const handleMessage = useCallback((event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

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
        break;

      case 'room_joined':
        setCurrentRoom(data.room);
        setIsHost(false);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        setMembers(data.members || []);
        setMessages(data.messages || []);
        break;

      case 'room_updated':
        setCurrentRoom(data.room);
        setRoomName(data.room.name);
        setIsPublic(data.room.isPublic);
        break;

      case 'user_joined':
        setMembers(data.members || []);
        if (data.systemMessage) {
          setMessages(prev => [...prev, data.systemMessage]);
        }
        break;

      case 'user_left':
        setMembers(data.members || []);
        if (data.systemMessage) {
          setMessages(prev => [...prev, data.systemMessage]);
        }
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
        break;

      case 'left_room':
        setCurrentRoom(null);
        setIsHost(false);
        setRoomName('');
        setIsPublic(false);
        setMembers([]);
        setMessages([]);
        break;

      case 'public_rooms':
        setPublicRooms(data.rooms || []);
        break;

      case 'error':
        console.warn('[Room] Server error:', data.message);
        break;

      default:
        break;
    }
  }, []);

  // ------ Connect WebSocket ------
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectedRef.current = true;
      // Send our username immediately
      ws.send(JSON.stringify({ type: 'set_username', name: username }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      isConnectedRef.current = false;
      // Auto-reconnect after 2s
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      // Will trigger onclose
    };
  }, [username, handleMessage]);

  // ------ Initialize connection ------
  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // ------ Actions ------

  const setUsername = useCallback((name) => {
    const trimmed = (name || '').trim().slice(0, 30);
    if (!trimmed) return;
    setUsernameState(trimmed);
    wsSend({ type: 'set_username', name: trimmed });
  }, [wsSend]);

  const createRoom = useCallback((name) => {
    wsSend({ type: 'create_room', name: name || `${username}'s Stage` });
  }, [wsSend, username]);

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

  // Audience list (exclude host for audience count)
  const audience = members.filter(m => !m.isHost);

  const value = {
    // User
    username,
    userId,
    setUsername,
    // Room state
    currentRoom,
    isHost,
    roomName,
    isPublic,
    members,
    audience,
    publicRooms,
    // Chat
    messages,
    sendMessage,
    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    togglePublic,
    updateRoomName,
    updateNowPlaying,
    // Connection state
    isConnected: isConnectedRef.current,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
}

export default RoomContext;
