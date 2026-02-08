import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Generate a random guest name
const ADJECTIVES = ['Cosmic', 'Neon', 'Stellar', 'Lunar', 'Solar', 'Astral', 'Nova', 'Vivid', 'Sonic', 'Drift'];
const NOUNS = ['Fox', 'Wolf', 'Hawk', 'Owl', 'Bear', 'Lynx', 'Crow', 'Moth', 'Orca', 'Stag'];

function generateGuestName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

// Generate a unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Mock public rooms for the Stage sidebar
const MOCK_ROOMS = [
  {
    id: 'room-crptk',
    name: "Crptk's Stage",
    hostName: 'Crptk',
    isPublic: true,
    nowPlaying: { title: 'kyslingo - glory', source: 'soundcloud' },
    audienceCount: 3,
    createdAt: Date.now() - 120000,
  },
  {
    id: 'room-dj-nova',
    name: 'Late Night Vibes',
    hostName: 'DJNova42',
    isPublic: true,
    nowPlaying: { title: 'Flume - Say It', source: 'soundcloud' },
    audienceCount: 7,
    createdAt: Date.now() - 300000,
  },
  {
    id: 'room-chillwave',
    name: 'Chillwave Station',
    hostName: 'WaveRider',
    isPublic: true,
    nowPlaying: { title: 'Tycho - Awake', source: 'soundcloud' },
    audienceCount: 12,
    createdAt: Date.now() - 600000,
  },
  {
    id: 'room-bass',
    name: 'Bass Cathedral',
    hostName: 'SubFreq',
    isPublic: true,
    nowPlaying: { title: 'ODESZA - A Moment Apart', source: 'soundcloud' },
    audienceCount: 5,
    createdAt: Date.now() - 180000,
  },
];

// Mock audience members that join/leave
const MOCK_AUDIENCE = [
  { id: 'user-1', name: 'CosmicFox42' },
  { id: 'user-2', name: 'NeonWolf88' },
  { id: 'user-3', name: 'StellarOwl11' },
];

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  // Current user identity
  const [username] = useState(() => generateGuestName());
  const [userId] = useState(() => generateId());

  // Room state
  const [currentRoom, setCurrentRoom] = useState(null); // null = not in a room
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Audience in current room
  const [audience, setAudience] = useState([]);

  // Public rooms (browsable)
  const [publicRooms, setPublicRooms] = useState(MOCK_ROOMS);

  // Chat messages for current room
  const [messages, setMessages] = useState([]);

  // Simulate mock audience joining when host goes public
  const mockJoinTimersRef = useRef([]);

  // Create a room (when user imports audio)
  const createRoom = useCallback(() => {
    const room = {
      id: generateId(),
      name: `${username}'s Stage`,
      hostId: userId,
      hostName: username,
      isPublic: false,
      nowPlaying: null,
      audienceCount: 0,
      createdAt: Date.now(),
    };
    setCurrentRoom(room);
    setIsHost(true);
    setRoomName(room.name);
    setIsPublic(false);
    setAudience([]);
    setMessages([]);
    return room;
  }, [username, userId]);

  // Join a public room (as audience)
  const joinRoom = useCallback((room) => {
    setCurrentRoom(room);
    setIsHost(false);
    setRoomName(room.name);
    setIsPublic(room.isPublic);
    setAudience(MOCK_AUDIENCE);
    setMessages([
      {
        id: generateId(),
        userId: 'system',
        username: 'System',
        text: `Welcome to ${room.name}!`,
        timestamp: Date.now(),
        isSystem: true,
      },
      {
        id: generateId(),
        userId: room.hostId || 'host',
        username: room.hostName,
        text: 'Hey, welcome to my stage!',
        timestamp: Date.now() - 5000,
        isHost: true,
      },
    ]);
  }, []);

  // Leave the current room
  const leaveRoom = useCallback(() => {
    // Clear mock timers
    mockJoinTimersRef.current.forEach(clearTimeout);
    mockJoinTimersRef.current = [];

    // If host was public, remove from public rooms list
    if (isHost && isPublic && currentRoom) {
      setPublicRooms((prev) => prev.filter((r) => r.id !== currentRoom.id));
    }

    setCurrentRoom(null);
    setIsHost(false);
    setRoomName('');
    setIsPublic(false);
    setAudience([]);
    setMessages([]);
  }, [isHost, isPublic, currentRoom]);

  // Toggle public/private
  const togglePublic = useCallback(() => {
    setIsPublic((prev) => {
      const next = !prev;
      if (next && currentRoom) {
        // Add to public rooms
        const publicRoom = {
          ...currentRoom,
          name: roomName,
          isPublic: true,
        };
        setPublicRooms((rooms) => [publicRoom, ...rooms]);

        // Simulate audience joining after going public
        const timers = MOCK_AUDIENCE.map((user, i) =>
          setTimeout(() => {
            setAudience((prev) => {
              if (prev.find((u) => u.id === user.id)) return prev;
              return [...prev, user];
            });
            setMessages((prev) => [
              ...prev,
              {
                id: generateId(),
                userId: 'system',
                username: 'System',
                text: `${user.name} joined the stage`,
                timestamp: Date.now(),
                isSystem: true,
              },
            ]);
          }, 2000 + i * 3000)
        );
        mockJoinTimersRef.current = timers;
      } else if (!next && currentRoom) {
        // Remove from public rooms
        setPublicRooms((rooms) => rooms.filter((r) => r.id !== currentRoom.id));
        // Clear mock timers
        mockJoinTimersRef.current.forEach(clearTimeout);
        mockJoinTimersRef.current = [];
      }
      return next;
    });
  }, [currentRoom, roomName]);

  // Update room name
  const updateRoomName = useCallback(
    (name) => {
      setRoomName(name);
      if (currentRoom) {
        setCurrentRoom((prev) => ({ ...prev, name }));
        // Update in public rooms if public
        if (isPublic) {
          setPublicRooms((rooms) =>
            rooms.map((r) => (r.id === currentRoom.id ? { ...r, name } : r))
          );
        }
      }
    },
    [currentRoom, isPublic]
  );

  // Update now playing info in the room
  const updateNowPlaying = useCallback(
    (nowPlaying) => {
      if (currentRoom) {
        setCurrentRoom((prev) => ({ ...prev, nowPlaying }));
        if (isPublic) {
          setPublicRooms((rooms) =>
            rooms.map((r) => (r.id === currentRoom.id ? { ...r, nowPlaying } : r))
          );
        }
      }
    },
    [currentRoom, isPublic]
  );

  // Send a chat message
  const sendMessage = useCallback(
    (text) => {
      if (!text.trim()) return;
      const msg = {
        id: generateId(),
        userId,
        username,
        text: text.trim(),
        timestamp: Date.now(),
        isHost,
      };
      setMessages((prev) => [...prev, msg]);

      // Simulate mock reply if host
      if (isHost && Math.random() > 0.5) {
        const randomUser = MOCK_AUDIENCE[Math.floor(Math.random() * MOCK_AUDIENCE.length)];
        const replies = [
          'this goes hard',
          'fire track',
          'the visuals are insane',
          'love the vibes',
          'next song?',
          'this is beautiful',
          'bass hits different here',
        ];
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              userId: randomUser.id,
              username: randomUser.name,
              text: replies[Math.floor(Math.random() * replies.length)],
              timestamp: Date.now(),
              isHost: false,
            },
          ]);
        }, 1500 + Math.random() * 3000);
      }
    },
    [userId, username, isHost]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mockJoinTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const value = {
    // User
    username,
    userId,
    // Room state
    currentRoom,
    isHost,
    roomName,
    isPublic,
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
