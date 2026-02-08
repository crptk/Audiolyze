import { useState, useRef, useEffect } from 'react';
import { useRoom } from '../context/RoomContext';
import '../styles/room-chat.css';

export default function RoomChat({ visible }) {
  const { currentRoom, messages, sendMessage, isHost } = useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    // Track unread when closed
    if (!isOpen && messages.length > prevMsgCountRef.current) {
      setHasUnread(true);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, isOpen]);

  // Clear unread on open
  useEffect(() => {
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  if (!visible || !currentRoom) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Toggle button */}
      <button
        className={`chat-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Chat"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {hasUnread && <span className="chat-unread-dot"></span>}
      </button>

      {/* Chat panel */}
      <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3>Chat</h3>
          <span className="chat-header-count">{messages.length}</span>
          <button className="chat-close" onClick={() => setIsOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <p>No messages yet</p>
              <span>Say something to the stage</span>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.isSystem ? 'system' : ''} ${msg.isHost ? 'host' : ''}`}
              >
                {msg.isSystem ? (
                  <p className="chat-system-text">{msg.text}</p>
                ) : (
                  <>
                    <div className="chat-message-header">
                      <span className={`chat-username ${msg.isHost ? 'host' : ''}`}>
                        {msg.username}
                        {msg.isHost && <span className="chat-host-tag">HOST</span>}
                      </span>
                      <span className="chat-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <p className="chat-text">{msg.text}</p>
                  </>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
          />
          <button
            className="chat-send"
            type="submit"
            disabled={!input.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
