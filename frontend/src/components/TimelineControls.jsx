'use client';

import { useState, useEffect, useRef } from 'react';
import '../styles/timeline.css';

export default function TimelineControls({ 
  audioFile, 
  aiParams,
  currentTime,
  duration,
  isPlaying,
  playbackSpeed,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onShapeChange,
  currentShape
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showManualControls, setShowManualControls] = useState(false);
  const timelineRef = useRef(null);

  const shapes = [
    { id: 'jellyfish', label: 'Jellyfish', icon: '🪼' },
    { id: 'sphere', label: 'Sphere', icon: '⚫' },
    { id: 'torus', label: 'Torus', icon: '🍩' },
    { id: 'spiral', label: 'Spiral', icon: '🌀' },
    { id: 'cube', label: 'Cube', icon: '🧊' },
    { id: 'wave', label: 'Wave', icon: '🌊' }
  ];

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    onSeek(newTime);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleTimelineClick(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleTimelineClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`timeline-controls ${aiParams ? 'visible' : ''}`}>
      {/* Manual Controls Dropdown */}
      <div className="manual-controls-wrapper">
        <button 
          className="manual-controls-toggle"
          onClick={() => setShowManualControls(!showManualControls)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
          </svg>
          Manual Controls
        </button>
        
        {showManualControls && (
          <div className="manual-controls-dropdown">
            <div className="dropdown-header">Shape Selection</div>
            <div className="shape-grid">
              {shapes.map(shape => (
                <button
                  key={shape.id}
                  className={`shape-button ${currentShape === shape.id ? 'active' : ''}`}
                  onClick={() => {
                    onShapeChange(shape.id);
                    setShowManualControls(false);
                  }}
                  title={shape.label}
                >
                  <span className="shape-icon">{shape.icon}</span>
                  <span className="shape-label">{shape.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="timeline-container">
        {/* Timeline */}
        <div 
          className="timeline"
          ref={timelineRef}
          onMouseDown={handleMouseDown}
        >
          <div className="timeline-track">
            <div 
              className="timeline-progress" 
              style={{ width: `${progress}%` }}
            />
            <div 
              className="timeline-handle" 
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* Time Display */}
        <div className="time-display">
          <span className="time-current">{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="time-total">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="controls-container">
        {/* Play/Pause Button */}
        <button 
          className="control-button play-pause"
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16" fill="currentColor" />
              <rect x="14" y="4" width="4" height="16" fill="currentColor" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Speed Control */}
        <div className="speed-controls">
          <button 
            className={`speed-button ${playbackSpeed === 0.5 ? 'active' : ''}`}
            onClick={() => onSpeedChange(0.5)}
            title="0.5x speed"
          >
            0.5x
          </button>
          <button 
            className={`speed-button ${playbackSpeed === 1 ? 'active' : ''}`}
            onClick={() => onSpeedChange(1)}
            title="Normal speed"
          >
            1x
          </button>
          <button 
            className={`speed-button ${playbackSpeed === 1.5 ? 'active' : ''}`}
            onClick={() => onSpeedChange(1.5)}
            title="1.5x speed"
          >
            1.5x
          </button>
          <button 
            className={`speed-button ${playbackSpeed === 2 ? 'active' : ''}`}
            onClick={() => onSpeedChange(2)}
            title="2x speed"
          >
            2x
          </button>
        </div>
      </div>
    </div>
  );
}
