import { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import '../styles/stage-sidebar.css';

export default function StageSidebar({ visible }) {
  const { publicRooms, joinRoom, currentRoom } = useRoom();
  const [isOpen, setIsOpen] = useState(false);

  if (!visible) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        className={`stage-sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Browse Stages"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
        <span className="stage-sidebar-toggle-label">Stage</span>
        {publicRooms.length > 0 && (
          <span className="stage-sidebar-badge">{publicRooms.length}</span>
        )}
      </button>

      {/* Sidebar panel */}
      <div className={`stage-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="stage-sidebar-header">
          <h2 className="stage-sidebar-title">Stage</h2>
          <button className="stage-sidebar-close" onClick={() => setIsOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="stage-sidebar-rooms">
          {publicRooms.length === 0 ? (
            <div className="stage-sidebar-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 10h.01M15 10h.01M8 15s1.5 2 4 2 4-2 4-2" />
              </svg>
              <p>No live stages right now</p>
              <span>Start playing music to create one</span>
            </div>
          ) : (
            publicRooms.map((room) => (
              <button
                key={room.id}
                className={`stage-sidebar-room ${currentRoom?.id === room.id ? 'active' : ''}`}
                onClick={() => {
                  joinRoom(room);
                  setIsOpen(false);
                }}
                disabled={currentRoom?.id === room.id}
              >
                <div className="sidebar-room-top">
                  <span className="sidebar-room-name">{room.name}</span>
                  <span className="sidebar-room-live">
                    <span className="sidebar-live-dot"></span>
                    LIVE
                  </span>
                </div>
                <div className="sidebar-room-host">
                  hosted by <span>{room.hostName}</span>
                </div>
                {room.nowPlaying && (
                  <div className="sidebar-room-playing">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    <span>{room.nowPlaying.title}</span>
                  </div>
                )}
                <div className="sidebar-room-audience">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>{room.audienceCount} listening</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && <div className="stage-sidebar-backdrop" onClick={() => setIsOpen(false)} />}
    </>
  );
}
