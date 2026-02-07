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
  currentShape,
  currentEnvironment,
  onEnvironmentChange,
  onReset,
  nowPlaying = null,
  playlistQueue = [],
  playlistIndex = -1,
  audioTuning = { bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0 },
  onAudioTuningChange,
  audioPlaybackTuning = { bass: 1.0, mid: 1.0, treble: 1.0, sensitivity: 1.0 },
  onAudioPlaybackTuningChange,
  tuningLinked = true,
  onTuningLinkedChange,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [showManualControls, setShowManualControls] = useState(false);
  const [showShapeDropdown, setShowShapeDropdown] = useState(false);
  const [showEnvironmentDropdown, setShowEnvironmentDropdown] = useState(false);
  const timelineRef = useRef(null);
  const shapeDropdownRef = useRef(null);
  const environmentDropdownRef = useRef(null);

  const shapes = [
    { id: 'jellyfish', label: 'Jellyfish', icon: '🪼' },
    { id: 'sphere', label: 'Sphere', icon: '⚫' },
    { id: 'torus', label: 'Torus', icon: '🍩' },
    { id: 'spiral', label: 'Spiral', icon: '🌀' },
    { id: 'cube', label: 'Cube', icon: '🧊' },
    { id: 'wave', label: 'Wave', icon: '🌊' }
  ];

  const environments = [
    { id: 'warp', label: 'Warp' },
    { id: 'orbit', label: 'Orbit' },
    { id: 'aurora', label: 'Aurora' },
    { id: 'fireflies', label: 'Fireflies' },
    { id: 'rain', label: 'Rain' },
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

  // Close shape dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shapeDropdownRef.current && !shapeDropdownRef.current.contains(event.target)) {
        setShowShapeDropdown(false);
      }
    };

    if (showShapeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showShapeDropdown]);

  // Close environment dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (environmentDropdownRef.current && !environmentDropdownRef.current.contains(event.target)) {
        setShowEnvironmentDropdown(false);
      }
    };

    if (showEnvironmentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEnvironmentDropdown]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Dynamic timestamps from backend structural analysis
  // Shape changes also trigger environment switches in the visualizer
  const SHAPE_TIMESTAMPS = aiParams?.shapeChanges || [30, 60, 90, 120];

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
            <div className="custom-dropdown" ref={shapeDropdownRef}>
              <button
                className="dropdown-trigger"
                onClick={() => setShowShapeDropdown(!showShapeDropdown)}
              >
                <div className="dropdown-value">
                  {currentShape ? (
                    <>
                      <span className="shape-icon">{shapes.find(s => s.id === currentShape)?.icon}</span>
                      <span className="shape-label">{shapes.find(s => s.id === currentShape)?.label}</span>
                    </>
                  ) : (
                    <span className="shape-label">Select a shape</span>
                  )}
                </div>
                <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="2 4 6 8 10 4" />
                </svg>
              </button>

              {showShapeDropdown && (
                <div className="dropdown-menu">
                  {shapes.map(shape => (
                    <button
                      key={shape.id}
                      className={`dropdown-item ${currentShape === shape.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onShapeChange(shape.id);
                        setShowShapeDropdown(false);
                      }}
                    >
                      <span className="shape-icon">{shape.icon}</span>
                      <span className="shape-label">{shape.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="dropdown-header" style={{ marginTop: '16px' }}>Audio EQ</div>
            <div className="audio-sliders">
              {[
                { key: 'bass', label: 'Bass', min: 0, max: 3, step: 0.1 },
                { key: 'mid', label: 'Mid', min: 0, max: 3, step: 0.1 },
                { key: 'treble', label: 'Treble', min: 0, max: 3, step: 0.1 },
                { key: 'sensitivity', label: 'Volume', min: 0.1, max: 3, step: 0.1 },
              ].map(slider => (
                <div key={`audio-${slider.key}`} className="audio-slider-row">
                  <label className="audio-slider-label">{slider.label}</label>
                  <input
                    type="range"
                    className="audio-slider"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={audioPlaybackTuning[slider.key]}
                    onChange={(e) => {
                      onAudioPlaybackTuningChange({
                        ...audioPlaybackTuning,
                        [slider.key]: parseFloat(e.target.value),
                      });
                    }}
                  />
                  <span className="audio-slider-value">{audioPlaybackTuning[slider.key].toFixed(1)}</span>
                </div>
              ))}
            </div>

            <label className="tuning-link-row">
              <input
                type="checkbox"
                className="tuning-link-checkbox"
                checked={tuningLinked}
                onChange={(e) => {
                  onTuningLinkedChange(e.target.checked);
                  if (e.target.checked) {
                    onAudioTuningChange({ ...audioPlaybackTuning });
                  }
                }}
              />
              <svg className="tuning-link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {tuningLinked ? (
                  <>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </>
                ) : (
                  <>
                    <path d="M16.85 7.15a4 4 0 0 1 0 5.66l-3 3a4 4 0 0 1-5.66-5.66l1.41-1.41" />
                    <path d="M7.15 16.85a4 4 0 0 1 0-5.66l3-3a4 4 0 0 1 5.66 5.66l-1.41 1.41" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </>
                )}
              </svg>
              <span className="tuning-link-label">{tuningLinked ? 'Linked' : 'Unlinked'}</span>
            </label>

            <div className="dropdown-header" style={{ marginTop: '16px' }}>Visualizer Tuning</div>
            <div className="audio-sliders">
              {[
                { key: 'bass', label: 'Bass', min: 0, max: 3, step: 0.1 },
                { key: 'mid', label: 'Mid', min: 0, max: 3, step: 0.1 },
                { key: 'treble', label: 'Treble', min: 0, max: 3, step: 0.1 },
                { key: 'sensitivity', label: 'Sensitivity', min: 0.1, max: 3, step: 0.1 },
              ].map(slider => (
                <div key={`vis-${slider.key}`} className="audio-slider-row">
                  <label className="audio-slider-label">{slider.label}</label>
                  <input
                    type="range"
                    className={`audio-slider ${tuningLinked ? 'linked-disabled' : ''}`}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={tuningLinked ? audioPlaybackTuning[slider.key] : audioTuning[slider.key]}
                    disabled={tuningLinked}
                    onChange={(e) => {
                      onAudioTuningChange({
                        ...audioTuning,
                        [slider.key]: parseFloat(e.target.value),
                      });
                    }}
                  />
                  <span className="audio-slider-value">
                    {(tuningLinked ? audioPlaybackTuning[slider.key] : audioTuning[slider.key]).toFixed(1)}
                  </span>
                </div>
              ))}
            </div>

            <div className="dropdown-header" style={{ marginTop: '16px' }}>Environment</div>
            <div className="custom-dropdown" ref={environmentDropdownRef}>
              <button
                className="dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEnvironmentDropdown(!showEnvironmentDropdown);
                }}
              >
                <div className="dropdown-value">
                  {currentEnvironment ? (
                    <span className="shape-label">{environments.find(e => e.id === currentEnvironment)?.label || 'Select environment'}</span>
                  ) : (
                    <span className="shape-label">Select environment</span>
                  )}
                </div>
                <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="2 4 6 8 10 4" />
                </svg>
              </button>

              {showEnvironmentDropdown && (
                <div className="dropdown-menu">
                  {environments.map(env => (
                    <button
                      key={env.id}
                      className={`dropdown-item ${currentEnvironment === env.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEnvironmentChange(env.id);
                        setShowEnvironmentDropdown(false);
                      }}
                    >
                      <span className="shape-label">{env.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '4px 0', marginTop: '8px' }}>
              Auto-switches with shape changes
            </div>

            <div className="dropdown-header" style={{ marginTop: '16px' }}>Controls</div>
            <button
              className="reset-button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              title="Reset visualizer to initial state"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>Reset Visualizer</span>
            </button>
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
            {/* Shape + environment change markers */}
            {duration > 0 && SHAPE_TIMESTAMPS.map((time, idx) => (
              <div
                key={`shape-${idx}`}
                className="timeline-marker shape-marker"
                style={{ left: `${(time / duration) * 100}%` }}
                title={`Shape & environment change at ${formatTime(time)}`}
              >
                <div className="marker-dot" />
              </div>
            ))}

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

        {/* Now Playing (right-aligned) */}
        {nowPlaying && (
          <div className="now-playing">
            <div className="now-playing-icon">
              {nowPlaying.source === 'soundcloud' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.56 8.87V17h8.76c1.85 0 3.35-1.67 3.35-3.73 0-2.07-1.5-3.74-3.35-3.74-.34 0-.67.05-.98.14C18.87 6.66 16.5 4.26 13.56 4.26c-.84 0-1.63.2-2.33.56v4.05zm-1.3-3.2v11.33h-.5V6.4c-.5-.2-1.03-.31-1.59-.31-2.35 0-4.25 2.08-4.25 4.64 0 .4.05.79.14 1.17-.13-.01-.26-.02-.4-.02-1.85 0-3.35 1.59-3.35 3.56S1.81 19 3.66 19h5.1V5.67z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              )}
            </div>
            <div className="now-playing-info">
              <span className="now-playing-label">Now Playing</span>
              <span className="now-playing-title">{nowPlaying.title}</span>
              {playlistQueue.length > 1 && (
                <span className="now-playing-queue">
                  {playlistIndex + 1} / {playlistQueue.length}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
