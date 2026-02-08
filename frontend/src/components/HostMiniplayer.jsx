import { useState } from 'react';
import '../styles/host-miniplayer.css';

export default function HostMiniplayer({ visible, hostedRoom, onReturn, onEnd }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  if (!visible || !hostedRoom) return null;

  const handleEnd = () => {
    if (!showConfirmEnd) {
      setShowConfirmEnd(true);
      return;
    }
    onEnd();
    setShowConfirmEnd(false);
    setIsExpanded(false);
  };

  return (
    <div className={`host-miniplayer ${isExpanded ? 'expanded' : ''}`}>
      {/* Collapsed bar */}
      <button
        className="host-miniplayer-bar"
        onClick={() => { setIsExpanded(!isExpanded); setShowConfirmEnd(false); }}
      >
        <div className="miniplayer-bar-left">
          <span className="miniplayer-pulse"></span>
          <span className="miniplayer-label">Your Stage</span>
        </div>
        <div className="miniplayer-bar-center">
          {hostedRoom.nowPlaying ? (
            <span className="miniplayer-track">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              {hostedRoom.nowPlaying.title}
            </span>
          ) : (
            <span className="miniplayer-track-empty">No track</span>
          )}
        </div>
        <div className="miniplayer-bar-right">
          <span className="miniplayer-audience">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            {hostedRoom.audienceCount || 0}
          </span>
          <svg
            className={`miniplayer-chevron ${isExpanded ? 'up' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="host-miniplayer-panel">
          <div className="miniplayer-info">
            <div className="miniplayer-room-name">{hostedRoom.name}</div>
            {hostedRoom.nowPlaying && (
              <div className="miniplayer-now-playing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span>{hostedRoom.nowPlaying.title}</span>
              </div>
            )}
            <div className="miniplayer-stats">
              <span className="miniplayer-stat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {hostedRoom.audienceCount || 0} listening
              </span>
              <span className={`miniplayer-stat ${hostedRoom.isPublic ? 'public' : 'private'}`}>
                {hostedRoom.isPublic ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
                {hostedRoom.isPublic ? 'Public' : 'Private'}
              </span>
            </div>
          </div>

          <div className="miniplayer-actions">
            <button className="miniplayer-return-btn" onClick={onReturn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Return to My Stage
            </button>
            {showConfirmEnd ? (
              <div className="miniplayer-confirm-end">
                <span>End your stage?</span>
                <button className="miniplayer-confirm-yes" onClick={handleEnd}>
                  Yes, End
                </button>
                <button className="miniplayer-confirm-no" onClick={() => setShowConfirmEnd(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="miniplayer-end-btn" onClick={handleEnd}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                End My Stage
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
