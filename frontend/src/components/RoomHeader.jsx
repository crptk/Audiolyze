import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import '../styles/room-header.css';

export default function RoomHeader({ visible }) {
  const { currentRoom, isHost, isPublic, roomName, togglePublic, updateRoomName, leaveRoom, audience, username } = useRoom();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!visible || !currentRoom) return null;

  const handleStartEdit = () => {
    if (!isHost || !isPublic) return;
    setEditName(roomName);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim()) {
      updateRoomName(editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div className="room-header">
      <div className="room-header-left">
        {/* Role badge */}
        <div className={`room-role-badge ${isHost ? 'host' : 'audience'}`}>
          {isHost ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
          <span>{isHost ? 'Host' : 'Audience'}</span>
        </div>

        {/* Room name */}
        {isEditing ? (
          <input
            ref={inputRef}
            className="room-name-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            maxLength={40}
          />
        ) : (
          <button
            className={`room-name-display ${isHost && isPublic ? 'editable' : ''}`}
            onClick={handleStartEdit}
            disabled={!isHost || !isPublic}
          >
            {roomName}
            {isHost && isPublic && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="room-header-right">
        {/* Audience count */}
        {audience.length > 0 && (
          <div className="room-audience-count">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{audience.length}</span>
          </div>
        )}

        {/* Guest name */}
        <div className="room-username">
          {username}
        </div>

        {/* Public/Private toggle (host only) */}
        {isHost && (
          <button
            className={`room-visibility-toggle ${isPublic ? 'public' : 'private'}`}
            onClick={togglePublic}
            title={isPublic ? 'Make Private' : 'Make Public'}
          >
            {isPublic ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            <span>{isPublic ? 'Public' : 'Private'}</span>
          </button>
        )}

        {/* Leave room */}
        {!isHost && (
          <button className="room-leave-btn" onClick={leaveRoom} title="Leave Stage">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Leave</span>
          </button>
        )}
      </div>
    </div>
  );
}
