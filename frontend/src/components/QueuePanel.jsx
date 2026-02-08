import { useState, useRef } from 'react';
import { useRoom } from '../context/RoomContext';
import '../styles/queue-panel.css';

export default function QueuePanel({ visible, isAudience }) {
  const {
    queue, suggestions, mySuggestion, isHost,
    queueRemove, queueReorder, respondSuggestion, suggestSong,
  } = useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const [suggestMode, setSuggestMode] = useState(false);
  const [suggestUrl, setSuggestUrl] = useState('');
  const [suggestTitle, setSuggestTitle] = useState('');
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragItemRef = useRef(null);

  if (!visible) return null;

  // Split queue into sections
  const activeQueue = queue.filter(q => q.status !== 'played');
  const nowPlaying = activeQueue.find(q => q.status === 'playing');
  const priorityQueue = activeQueue.filter(q => q.status !== 'playing').slice(0, 3);
  const lowPriorityQueue = activeQueue.filter(q => q.status !== 'playing').slice(3);

  const handleDragStart = (e, idx) => {
    if (!isHost) return;
    dragItemRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragItemRef.current === null || dragItemRef.current === dropIdx) return;
    // Build new order for low-priority items
    const items = [...lowPriorityQueue];
    const [removed] = items.splice(dragItemRef.current, 1);
    items.splice(dropIdx, 0, removed);
    queueReorder(items.map(i => i.id));
    dragItemRef.current = null;
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragItemRef.current = null;
  };

  const handleSuggestSubmit = () => {
    if (!suggestUrl.trim()) return;
    // Determine if it's a SoundCloud URL
    const isSoundCloud = suggestUrl.includes('soundcloud.com');
    suggestSong(
      suggestTitle.trim() || suggestUrl.trim(),
      isSoundCloud ? 'soundcloud' : 'file',
      suggestUrl.trim()
    );
    setSuggestUrl('');
    setSuggestTitle('');
    setSuggestMode(false);
  };

  const queueCount = activeQueue.length;
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  return (
    <>
      {/* Queue toggle button */}
      <button
        className={`queue-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Song Queue"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="queue-toggle-label">Queue</span>
        {queueCount > 0 && (
          <span className="queue-badge">{queueCount}</span>
        )}
        {isHost && pendingSuggestions.length > 0 && (
          <span className="queue-suggestion-badge">{pendingSuggestions.length}</span>
        )}
      </button>

      {/* Queue panel */}
      <div className={`queue-panel ${isOpen ? 'open' : ''}`}>
        <div className="queue-panel-header">
          <h2 className="queue-panel-title">Queue</h2>
          <button className="queue-panel-close" onClick={() => setIsOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="queue-panel-content">
          {/* Now Playing */}
          {nowPlaying && (
            <div className="queue-section">
              <div className="queue-section-label">Now Playing</div>
              <div className="queue-item now-playing">
                <div className="queue-item-bars">
                  <span></span><span></span><span></span>
                </div>
                <div className="queue-item-info">
                  <span className="queue-item-title">{nowPlaying.title}</span>
                  <span className="queue-item-meta">{nowPlaying.source}</span>
                </div>
              </div>
            </div>
          )}

          {/* Up Next (Priority - locked) */}
          {priorityQueue.length > 0 && (
            <div className="queue-section">
              <div className="queue-section-label">
                Up Next
                <span className="queue-section-tag locked">Locked</span>
              </div>
              {priorityQueue.map((item, idx) => (
                <div key={item.id} className={`queue-item priority ${item.status === 'analyzing' ? 'analyzing' : ''}`}>
                  <span className="queue-item-number">{idx + 1}</span>
                  <div className="queue-item-info">
                    <span className="queue-item-title">{item.title}</span>
                    <span className="queue-item-meta">
                      {item.status === 'analyzing' ? 'Analyzing...' : item.status === 'ready' ? 'Ready' : item.source}
                      {item.addedByName && ` - added by ${item.addedByName}`}
                    </span>
                  </div>
                  {item.status === 'analyzing' && (
                    <div className="queue-item-spinner"></div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Low Priority Queue */}
          {lowPriorityQueue.length > 0 && (
            <div className="queue-section">
              <div className="queue-section-label">
                Later
                {isHost && <span className="queue-section-tag draggable">Drag to reorder</span>}
              </div>
              {lowPriorityQueue.map((item, idx) => (
                <div
                  key={item.id}
                  className={`queue-item low-priority ${dragOverIdx === idx ? 'drag-over' : ''}`}
                  draggable={isHost}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  {isHost && (
                    <span className="queue-item-drag-handle">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                        <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                      </svg>
                    </span>
                  )}
                  <span className="queue-item-number">{idx + 4}</span>
                  <div className="queue-item-info">
                    <span className="queue-item-title">{item.title}</span>
                    <span className="queue-item-meta">
                      {item.source}
                      {item.addedByName && ` - added by ${item.addedByName}`}
                    </span>
                  </div>
                  {isHost && (
                    <button className="queue-item-remove" onClick={() => queueRemove(item.id)} title="Remove">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {activeQueue.length === 0 && (
            <div className="queue-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <p>No songs in queue</p>
              <span>{isHost ? 'Play a song to start the queue' : 'Host hasn\'t added songs yet'}</span>
            </div>
          )}

          {/* Host: Suggestions Section */}
          {isHost && pendingSuggestions.length > 0 && (
            <div className="queue-section suggestions-section">
              <div className="queue-section-label">
                Suggestions
                <span className="queue-section-tag suggestion">{pendingSuggestions.length} pending</span>
              </div>
              {pendingSuggestions.map((s) => (
                <div key={s.id} className="queue-item suggestion">
                  <div className="queue-item-info">
                    <span className="queue-item-title">{s.title}</span>
                    <span className="queue-item-meta">from {s.username} - {s.source}</span>
                  </div>
                  <div className="suggestion-actions">
                    <button
                      className="suggestion-approve"
                      onClick={() => respondSuggestion(s.id, 'approve')}
                      title="Approve"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                    <button
                      className="suggestion-reject"
                      onClick={() => respondSuggestion(s.id, 'reject')}
                      title="Reject"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Audience: Suggest Song */}
          {isAudience && !isHost && (
            <div className="queue-section suggest-section">
              {mySuggestion ? (
                <div className="suggest-pending">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Your suggestion "{mySuggestion.title}" is pending</span>
                </div>
              ) : suggestMode ? (
                <div className="suggest-form">
                  <input
                    type="text"
                    className="suggest-input"
                    placeholder="SoundCloud URL..."
                    value={suggestUrl}
                    onChange={(e) => setSuggestUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSuggestSubmit(); }}
                    autoFocus
                  />
                  <input
                    type="text"
                    className="suggest-input suggest-title-input"
                    placeholder="Song title (optional)"
                    value={suggestTitle}
                    onChange={(e) => setSuggestTitle(e.target.value)}
                  />
                  <div className="suggest-form-actions">
                    <button className="suggest-submit-btn" onClick={handleSuggestSubmit} disabled={!suggestUrl.trim()}>
                      Suggest
                    </button>
                    <button className="suggest-cancel-btn" onClick={() => { setSuggestMode(false); setSuggestUrl(''); setSuggestTitle(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="suggest-song-btn" onClick={() => setSuggestMode(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Suggest a Song
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && <div className="queue-backdrop" onClick={() => setIsOpen(false)} />}
    </>
  );
}
