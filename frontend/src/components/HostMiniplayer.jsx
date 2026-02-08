import { useState, useRef, useCallback, useEffect } from 'react';
import '../styles/host-miniplayer.css';

export default function HostMiniplayer({ visible, hostedRoom, onReturn, onEnd }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const containerRef = useRef(null);

  // Reset position when visibility changes
  useEffect(() => {
    if (visible) {
      setPosition({ x: 0, y: 0 });
      setIsExpanded(false);
      setShowConfirmEnd(false);
    }
  }, [visible]);

  const handlePointerDown = useCallback((e) => {
    // Only allow drag from the bar, not from buttons inside the panel
    if (e.target.closest('.host-miniplayer-panel')) return;
    if (e.target.closest('.miniplayer-return-btn')) return;
    if (e.target.closest('.miniplayer-end-btn')) return;
    if (e.target.closest('.miniplayer-confirm-yes')) return;
    if (e.target.closest('.miniplayer-confirm-no')) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Only count as drag if moved more than 5px
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDraggedRef.current = true;
    }

    setPosition({
      x: posStartRef.current.x + dx,
      y: posStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handlePointerUp = useCallback((e) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Snap back if dragged off screen
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let newX = position.x + (e.clientX - dragStartRef.current.x);
      let newY = position.y;

      // Keep at least 80px visible
      if (rect.right < 80) newX = newX + (80 - rect.right);
      if (rect.left > vw - 80) newX = newX - (rect.left - (vw - 80));
      if (rect.bottom < 40) newY = newY + (40 - rect.bottom);
      if (rect.top > vh - 40) newY = newY - (rect.top - (vh - 40));

      setPosition({ x: newX, y: newY });
    }
  }, [isDragging, position]);

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

  const handleBarClick = () => {
    // Only toggle expand if we didn't drag
    if (!hasDraggedRef.current) {
      setIsExpanded(!isExpanded);
      setShowConfirmEnd(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`host-miniplayer ${isExpanded ? 'expanded' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Drag handle indicator */}
      <div className="miniplayer-drag-handle">
        <div className="drag-handle-dots">
          <span></span><span></span><span></span>
        </div>
      </div>

      {/* Collapsed bar */}
      <button
        className="host-miniplayer-bar"
        onClick={handleBarClick}
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
            <button className="miniplayer-return-btn" onClick={(e) => { e.stopPropagation(); onReturn(); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Return to My Stage
            </button>
            {showConfirmEnd ? (
              <div className="miniplayer-confirm-end">
                <span>End your stage?</span>
                <button className="miniplayer-confirm-yes" onClick={(e) => { e.stopPropagation(); handleEnd(); }}>
                  Yes, End
                </button>
                <button className="miniplayer-confirm-no" onClick={(e) => { e.stopPropagation(); setShowConfirmEnd(false); }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="miniplayer-end-btn" onClick={(e) => { e.stopPropagation(); handleEnd(); }}>
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
