'use client';

import '../styles/backbutton.css';

export default function BackButton({ onClick, visible }) {
  return (
    <button 
      className={`back-button ${visible ? 'visible' : ''}`}
      onClick={onClick}
      title="Back to import screen"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>Back</span>
    </button>
  );
}
